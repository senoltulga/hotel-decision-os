import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCase, validateCaseForAnalysis } from '../../src/domain/case/case.schema.ts';
import { validateMaxRevparProblem } from '../../src/domain/problems/problem.schema.ts';
import { NUMERICAL_POLICY, nearlyEqual, ratioEqual, parseNumericInput, percentageToRatio, percentagePointsToRatio } from '../../src/domain/numerics/numerical-policy.ts';
import { MAX_REVPAR_VARIABLES } from '../../src/domain/variables/variable.types.ts';

const base = () => ({
  schemaVersion: 'case.v1', id: 'hotel-1', revision: 0, name: 'Örnek Otel', currency: 'USD',
  period: { start: '2026-01-01', end: '2026-12-31' },
  minAdr: 130, maxAdr: 150, referenceAdr: 145, referenceOccupancy: .55,
  demand: { kind: 'linear-sensitivity', modelVersion: 'demand.v1', adrIncrease: 5, occupancyDecreasePp: 2, validMinAdr: 130, validMaxAdr: 150 },
});
const hasCode = (input: unknown, code: string) => {
  const result = validateCaseForAnalysis(input);
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.issues.some(issue => issue.code === code), JSON.stringify(result.issues));
};

test('Draft saklanabilir; aynı eksik veri analiz için reddedilir', () => {
  const draft = { schemaVersion: 'case.v1', id: 'h', revision: 0 };
  assert.equal(validateCase(draft).success, true);
  hasCode(draft, 'REQUIRED_FIELD');
});
test('Geçerli doğrusal Case kabul edilir; dış nesneyle bağlantısı koparılır', () => {
  const input = base(); const result = validateCaseForAnalysis(input);
  assert.ok(result.success);
  input.minAdr = 1;
  assert.equal(result.data.minAdr, 130);
});
test('Boş değerler eksiktir, sıfır doluluk geçerlidir', () => {
  hasCode({ ...base(), minAdr: null }, 'REQUIRED_FIELD');
  hasCode({ ...base(), name: ' ' }, 'REQUIRED_FIELD');
  assert.equal(validateCaseForAnalysis({ ...base(), referenceOccupancy: 0 }).success, true);
});
test('Geçersiz dış girdiler şemadan geçemez', () => {
  for (const input of [null, [], 'case', 1]) hasCode(input, 'INVALID_CASE');
  hasCode({ ...base(), unexpected: () => 1 }, 'INVALID_CASE');
  for (const n of [NaN, Infinity, -Infinity, '145', true, 0, -1]) hasCode({ ...base(), minAdr: n }, 'INVALID_NUMBER');
  for (const n of [-.01, 1.01, NaN, '55']) hasCode({ ...base(), referenceOccupancy: n }, 'INVALID_OCCUPANCY');
});
test('ADR sınırları: ters aralık reddedilir; tek fiyat geçerlidir', () => {
  hasCode({ ...base(), minAdr: 151 }, 'INVALID_ADR_RANGE');
  assert.equal(validateCaseForAnalysis({ ...base(), minAdr: 145, maxAdr: 145 }).success, true);
});
test('Tarih, para birimi, revizyon ve sürüm doğrulanır', () => {
  hasCode({ ...base(), period: { start: '2026-02-30', end: '2026-12-31' } }, 'INVALID_PERIOD');
  hasCode({ ...base(), period: { start: '2026-12-31', end: '2026-01-01' } }, 'INVALID_PERIOD');
  hasCode({ ...base(), currency: 'ZZZ' }, 'INVALID_CURRENCY');
  hasCode({ ...base(), revision: 1.5 }, 'INVALID_REVISION');
  hasCode({ ...base(), schemaVersion: 'case.v2' }, 'UNSUPPORTED_SCHEMA');
});
test('Doğrusal model referansları ve kapsam sınırları zorunludur', () => {
  hasCode({ ...base(), referenceAdr: undefined }, 'REQUIRED_FIELD');
  hasCode({ ...base(), minAdr: 120 }, 'OUTSIDE_DEMAND_DOMAIN');
  hasCode({ ...base(), referenceAdr: 160 }, 'OUTSIDE_DEMAND_DOMAIN');
  hasCode({ ...base(), demand: { ...base().demand, adrIncrease: 0 } }, 'INVALID_NUMBER');
  hasCode({ ...base(), demand: { ...base().demand, occupancyDecreasePp: -2 } }, 'INVALID_NUMBER');
  assert.equal(validateCaseForAnalysis({ ...base(), demand: { ...base().demand, occupancyDecreasePp: 0 } }).success, true);
});
const pointsCase = () => ({ ...base(), referenceAdr: undefined, referenceOccupancy: undefined, demand: {
  kind: 'scenario-points', modelVersion: 'demand.v1', points: [{ adr: 150, occupancy: .5 }, { adr: 130, occupancy: .65 }],
} });
test('Nokta modeli referanssız kabul edilir; noktalar kopyada sıralanır', () => {
  const input = pointsCase(); const result = validateCaseForAnalysis(input);
  assert.ok(result.success);
  assert.equal(input.demand.points[0].adr, 150);
  assert.equal(result.data.demand.kind, 'scenario-points');
  if (result.data.demand.kind === 'scenario-points') assert.equal(result.data.demand.points[0].adr, 130);
});
test('Tek nokta, tekrar ADR, artan doluluk ve alan dışı sınır reddedilir', () => {
  const input = pointsCase();
  hasCode({ ...input, demand: { ...input.demand, points: [{ adr: 130, occupancy: .5 }] } }, 'INVALID_POINTS');
  hasCode({ ...input, demand: { ...input.demand, points: [{ adr: 130, occupancy: .5 }, { adr: 130, occupancy: .5 }] } }, 'DUPLICATE_ADR_POINT');
  hasCode({ ...input, demand: { ...input.demand, points: [{ adr: 130, occupancy: .5 }, { adr: 150, occupancy: .6 }] } }, 'NON_MONOTONE_DEMAND');
  hasCode({ ...input, minAdr: 120 }, 'OUTSIDE_DEMAND_DOMAIN');
  hasCode({ ...input, referenceAdr: 145 }, 'REQUIRED_FIELD');
});
test('Desteklenmeyen model ve sürüm reddedilir', () => {
  hasCode({ ...base(), demand: { kind: 'ai-prediction' } }, 'UNSUPPORTED_DEMAND_MODEL');
  hasCode({ ...base(), demand: { ...base().demand, modelVersion: 'demand.v2' } }, 'UNSUPPORTED_MODEL_VERSION');
});
test('Türkçe ondalık ayrıştırma ve eksik-sıfır ayrımı', () => {
  assert.equal(parseNumericInput('145,25'), 145.25);
  assert.equal(parseNumericInput(' 145.25 '), 145.25);
  assert.equal(parseNumericInput('0'), 0);
  for (const v of [null, undefined, '', ' ']) assert.equal(parseNumericInput(v), undefined);
  for (const v of ['1.234,56', '1,234.56', '1 000', '1e3', 'NaN', true, Infinity]) assert.throws(() => parseNumericInput(v));
});
test('Yüzde ve yüzde puanı dönüşümleri ayrıdır', () => {
  assert.equal(percentageToRatio(55), .55);
  assert.equal(percentagePointsToRatio(2), .02);
  assert.throws(() => percentageToRatio(101));
  assert.throws(() => percentagePointsToRatio(-2));
});
test('Sayısal politika toleransı sonlu değerlere uygulanır; girdi aralığı gevşetilmez', () => {
  assert.equal(NUMERICAL_POLICY.version, 'numerics.v1');
  assert.ok(nearlyEqual(145, 145 + 1e-9));
  assert.ok(!nearlyEqual(145, 145 + 1e-5));
  assert.ok(ratioEqual(.55, .55 + 1e-11));
  assert.ok(!ratioEqual(.55, .55 + 1e-7));
  assert.ok(!nearlyEqual(Infinity, Infinity));
  hasCode({ ...base(), referenceOccupancy: 1 + 1e-12 }, 'INVALID_OCCUPANCY');
});
test('RevPAR hem derived hem objective rolünü taşır', () => {
  assert.deepEqual(MAX_REVPAR_VARIABLES.find(v => v.metric === 'revpar')?.roles, ['derived', 'objective']);
});
const problem = () => ({ problemVersion: 'max-revpar.v1', caseSnapshot: base(),
  objective: { metric: 'revpar', direction: 'max' }, decision: { metric: 'adr', min: 130, max: 150 },
  constraints: { occupancyMin: 0, occupancyMax: 1 }, calculationVersion: 'revpar.v1',
  solverVersion: 'max-revpar-solver.v1', numericalPolicyVersion: 'numerics.v1' });
test('Geçerli Problem değişmez snapshot olarak döner', () => {
  const input = problem(); const result = validateMaxRevparProblem(input);
  assert.ok(result.success);
  assert.ok(Object.isFrozen(result.data.caseSnapshot.demand));
  assert.throws(() => { (result.data.decision as { min: number }).min = 1; }, TypeError);
  input.caseSnapshot.minAdr = 1;
  assert.equal(result.data.caseSnapshot.minAdr, 130);
});
test('Problem Case ile tutarsız sınırları ve doğrulanmamış taslağı reddeder', () => {
  for (const input of [null, { ...problem(), decision: { metric: 'adr', min: 120, max: 150 } },
    { ...problem(), constraints: { occupancyMin: .9, occupancyMax: 1 } },
    { ...problem(), objective: { metric: 'noi', direction: 'max' } },
    { ...problem(), caseSnapshot: { schemaVersion: 'case.v1', id: 'h', revision: 0 } }]) {
    assert.equal(validateMaxRevparProblem(input).success, false);
  }
});
