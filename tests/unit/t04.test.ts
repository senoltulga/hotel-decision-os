import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMaxRevparProblem } from '../../src/domain/problems/max-revpar.builder.ts';
import { validateMaxRevparProblem } from '../../src/domain/problems/problem.schema.ts';

const base = () => ({ schemaVersion: 'case.v1', id: 'hotel-1', revision: 3, name: 'Örnek Otel', currency: 'USD',
  period: { start: '2026-01-01', end: '2026-12-31' }, minAdr: 130, maxAdr: 150, referenceAdr: 145, referenceOccupancy: .55,
  demand: { kind: 'linear-sensitivity', modelVersion: 'demand.v1', adrIncrease: 5, occupancyDecreasePp: 2, validMinAdr: 130, validMaxAdr: 150 } });
const points = () => ({ ...base(), referenceAdr: undefined, referenceOccupancy: undefined,
  demand: { kind: 'scenario-points', modelVersion: 'demand.v1', points: [{ adr: 150, occupancy: .5 }, { adr: 130, occupancy: .65 }] } });
function build(input: unknown = base()) {
  const result = buildMaxRevparProblem(input);
  assert.ok(result.success, JSON.stringify(result));
  return result;
}
test('Hazır Case standart hedef, karar, sınırlar ve sürümler üretir', () => {
  const result = build();
  assert.equal(result.readiness.status, 'READY');
  assert.deepEqual(result.problem.objective, { metric: 'revpar', direction: 'max' });
  assert.deepEqual(result.problem.decision, { metric: 'adr', min: 130, max: 150 });
  assert.deepEqual(result.problem.constraints, { occupancyMin: 0, occupancyMax: 1 });
  assert.equal(result.problem.caseSnapshot.id, 'hotel-1');
  assert.equal(result.problem.caseSnapshot.revision, 3);
  assert.equal(result.problem.problemVersion, 'max-revpar.v1');
  assert.equal(result.problem.calculationVersion, 'revpar.v1');
  assert.equal(result.problem.caseSnapshot.demand.modelVersion, 'demand.v1');
  assert.equal(result.problem.numericalPolicyVersion, 'numerics.v1');
});
test('Minimum doluluk varsayılanla değiştirilmez; sıfır geçerlidir', () => {
  assert.equal(build({ ...base(), minOccupancy: .6 }).problem.constraints.occupancyMin, .6);
  assert.equal(build({ ...base(), minOccupancy: 0 }).problem.constraints.occupancyMin, 0);
});
test('Eksik Case problem üretmez; eksik alanları açıklar', () => {
  const result = buildMaxRevparProblem({ ...base(), demand: undefined, minAdr: undefined });
  assert.equal(result.success, false);
  assert.equal(result.readiness.status, 'INCOMPLETE');
  assert.ok(!('problem' in result));
  assert.ok(result.issues.some(i => i.path === 'demand' && i.code === 'REQUIRED_FIELD'));
});
test('Geçersiz, alan dışı veya fiziksel olarak bozuk model problem üretmez', () => {
  for (const input of [null, { ...base(), minAdr: 160 }, { ...base(), minAdr: 120 }, { ...base(), referenceOccupancy: .99 }]) {
    const result = buildMaxRevparProblem(input);
    assert.equal(result.success, false);
    assert.equal(result.readiness.status, 'BLOCKED');
    assert.ok(!('problem' in result));
  }
});
test('Sahte veya eski READY etiketi hazır olmayan Case’i geçiremez', () => {
  const result = buildMaxRevparProblem({ ...base(), status: 'READY', readiness: { status: 'READY' }, minAdr: null });
  assert.equal(result.success, false);
  assert.equal(result.readiness.status, 'INCOMPLETE');
});
test('Case ve readiness sonucu sonradan değişse bile problem değişmez', () => {
  const input = base(); const result = build(input);
  input.minAdr = 140; input.demand.occupancyDecreasePp = 4;
  assert.equal(result.problem.decision.min, 130);
  assert.equal(result.problem.caseSnapshot.demand.kind, 'linear-sensitivity');
  if (result.problem.caseSnapshot.demand.kind === 'linear-sensitivity') assert.equal(result.problem.caseSnapshot.demand.occupancyDecreasePp, 2);
  assert.notEqual(result.readiness.caseSnapshot, result.problem.caseSnapshot);
  assert.throws(() => { (result.problem.caseSnapshot.period as { start: string }).start = '2025-01-01'; }, TypeError);
});
test('İç içe nokta dizileri, kısıtlar ve hedef derin dondurulur', () => {
  const problem = build(points()).problem;
  assert.ok(Object.isFrozen(problem) && Object.isFrozen(problem.objective) && Object.isFrozen(problem.constraints));
  if (problem.caseSnapshot.demand.kind === 'scenario-points') {
    assert.ok(Object.isFrozen(problem.caseSnapshot.demand.points));
    assert.ok(Object.isFrozen(problem.caseSnapshot.demand.points[0]));
    assert.equal(problem.caseSnapshot.demand.points[0].adr, 130);
  }
});
test('Referanssız noktalar referans veri uydurmadan problem üretir', () => {
  const problem = build(points()).problem;
  assert.equal(problem.caseSnapshot.referenceAdr, undefined);
  assert.equal(problem.caseSnapshot.referenceOccupancy, undefined);
});
test('Aynı girdi aynı problem JSON’unu üretir; import tekrar doğrulanır', () => {
  const problem = build().problem;
  assert.equal(JSON.stringify(problem), JSON.stringify(build().problem));
  const imported = validateMaxRevparProblem(JSON.parse(JSON.stringify(problem)));
  assert.ok(imported.success);
  assert.deepEqual(imported.data, problem);
});
test('Karşılanamayan doluluk problemi engellemez; uyarı korunur', () => {
  const result = build({ ...base(), minOccupancy: .7 });
  assert.equal(result.problem.constraints.occupancyMin, .7);
  assert.equal(result.readiness.warnings[0].code, 'NO_FEASIBLE_OCCUPANCY');
});
test('Tek ADR seçeneği ve sıfır duyarlılık problem sözleşmesinde korunur', () => {
  const input = base(); input.minAdr = input.maxAdr = 145; input.demand.occupancyDecreasePp = 0;
  assert.deepEqual(build(input).problem.decision, { metric: 'adr', min: 145, max: 145 });
});
test('İçe aktarılan bozulan sürüm, hedef, kısıt ve fiziksel model reddedilir', () => {
  const problem = build().problem;
  for (const input of [
    { ...problem, solverVersion: 'solver.unknown' }, { ...problem, numericalPolicyVersion: 'numerics.v2' },
    { ...problem, objective: { metric: 'revpar', direction: 'min' } },
    { ...problem, constraints: { occupancyMin: .8, occupancyMax: 1 } },
    { ...problem, caseSnapshot: { ...problem.caseSnapshot, referenceOccupancy: .99 } },
  ]) assert.equal(validateMaxRevparProblem(input).success, false);
});
test('Problem envelope dışında kalan dış özellikler taşınmaz', () => {
  const parsed = validateMaxRevparProblem({ ...build().problem, unused: () => 'external', optimalAdr: 999 });
  assert.ok(parsed.success);
  assert.ok(!('unused' in parsed.data));
  assert.ok(!('optimalAdr' in parsed.data));
});
