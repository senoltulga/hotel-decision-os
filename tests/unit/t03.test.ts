import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMaxRevparReadiness } from '../../src/domain/readiness/readiness.engine.ts';
import { validateCandidate } from '../../src/domain/constraints/constraint.validator.ts';
import { simulatePrice } from '../../src/domain/simulation/simulate-price.ts';

export const readyCase = () => ({ schemaVersion: 'case.v1', id: 'hotel', revision: 0, name: 'Örnek Otel', currency: 'USD',
  period: { start: '2026-01-01', end: '2026-12-31' }, minAdr: 130, maxAdr: 150, referenceAdr: 145, referenceOccupancy: .55,
  demand: { kind: 'linear-sensitivity', modelVersion: 'demand.v1', adrIncrease: 5, occupancyDecreasePp: 2, validMinAdr: 130, validMaxAdr: 150 } });
test('Hazır Case READY; eksik ve hata listeleri boş', () => {
  const result = checkMaxRevparReadiness(readyCase());
  assert.equal(result.status, 'READY');
  assert.deepEqual(result.missingFields, []);
  assert.deepEqual(result.issues, []);
});
test('Eksik model INCOMPLETE; kullanıcıya yalnız eksik alan sorulur', () => {
  const result = checkMaxRevparReadiness({ ...readyCase(), demand: undefined });
  assert.equal(result.status, 'INCOMPLETE');
  assert.deepEqual(result.missingFields.map(f => f.path), ['demand']);
  assert.ok(result.missingFields[0].reason.length > 20);
});
test('Eksik talep parametreleri hata yerine tamamlama alanına dönüşür', () => {
  const result = checkMaxRevparReadiness({ ...readyCase(), demand: { ...readyCase().demand, adrIncrease: undefined, occupancyDecreasePp: null } });
  assert.equal(result.status, 'INCOMPLETE');
  assert.deepEqual(result.missingFields.map(f => f.path), ['demand.adrIncrease', 'demand.occupancyDecreasePp']);
});
test('Eksik dönem gerçek iki tarih alanı olarak açıklanır', () => {
  const result = checkMaxRevparReadiness({ ...readyCase(), period: undefined });
  assert.equal(result.status, 'INCOMPLETE');
  assert.deepEqual(result.missingFields.map(f => f.path), ['period.start', 'period.end']);
});
test('Geçersiz veri BLOCKED önceliği taşır, eksikler yine görünür', () => {
  const result = checkMaxRevparReadiness({ ...readyCase(), minAdr: 160, name: undefined });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.issues.some(i => i.code === 'INVALID_ADR_RANGE' && i.remediation));
  assert.ok(result.missingFields.some(f => f.path === 'name'));
});
test('Talep alanı dışı sınır ve fiziksel doluluk BLOCKED', () => {
  assert.equal(checkMaxRevparReadiness({ ...readyCase(), minAdr: 120 }).status, 'BLOCKED');
  const result = checkMaxRevparReadiness({ ...readyCase(), referenceOccupancy: .99 });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.issues.some(i => i.code === 'INVALID_OCCUPANCY'));
});
test('Karşılanamayan minimum doluluk readiness engeli değildir', () => {
  const result = checkMaxRevparReadiness({ ...readyCase(), minOccupancy: .7 });
  assert.equal(result.status, 'READY');
  assert.equal(result.warnings[0].code, 'NO_FEASIBLE_OCCUPANCY');
});
test('Referanssız noktalar hazır, tek referans alanı eksik kabul edilir', () => {
  const input = { ...readyCase(), referenceAdr: undefined, referenceOccupancy: undefined, demand: { kind: 'scenario-points', modelVersion: 'demand.v1', points: [{ adr: 130, occupancy: .65 }, { adr: 150, occupancy: .5 }] } };
  assert.equal(checkMaxRevparReadiness(input).status, 'READY');
  const incomplete = checkMaxRevparReadiness({ ...input, referenceAdr: 145 });
  assert.equal(incomplete.status, 'INCOMPLETE');
  assert.equal(incomplete.missingFields[0].path, 'referenceOccupancy');
});
test('Baz ölçüm ile model uyuşmazlığı uyarı olarak açıklanır', () => {
  const input = { ...readyCase(), demand: { kind: 'scenario-points', modelVersion: 'demand.v1', points: [{ adr: 130, occupancy: .65 }, { adr: 150, occupancy: .5 }] } };
  const result = checkMaxRevparReadiness(input);
  assert.equal(result.status, 'READY');
  assert.ok(result.warnings.some(w => w.code === 'REFERENCE_MODEL_MISMATCH'));
});
test('Geçersiz Case ve bilinmeyen model düzeltme gerektirir', () => {
  assert.equal(checkMaxRevparReadiness(null).status, 'BLOCKED');
  assert.equal(checkMaxRevparReadiness({ ...readyCase(), demand: { kind: 'unknown', modelVersion: 'demand.v1' } }).status, 'BLOCKED');
});
const bounds = { minAdr: 130, maxAdr: 150, minOccupancy: .6 };
test('ADR ve doluluk kısıtları doğru denetlenir', () => {
  assert.ok(validateCandidate(132.5, .6, bounds).valid);
  assert.equal(validateCandidate(145, .55, bounds).issues[0].code, 'MIN_OCCUPANCY_VIOLATION');
  assert.equal(validateCandidate(129, .65, bounds).issues[0].code, 'ADR_BELOW_MIN');
  assert.equal(validateCandidate(151, .6, bounds).issues[0].code, 'ADR_ABOVE_MAX');
});
test('Bağlayıcı kısıtlar ve tek fiyatın iki sınırı', () => {
  assert.deepEqual(validateCandidate(132.5, .6, bounds).bindingConstraints, ['minOccupancy']);
  assert.deepEqual(validateCandidate(145, 1, { minAdr: 145, maxAdr: 145 }).bindingConstraints, ['minAdr', 'maxAdr', 'fullOccupancy']);
});
test('Kısıt toleransı ham sonucu değiştirmez; gerçek ihlali gizlemez', () => {
  assert.ok(validateCandidate(132.5, .6 - 1e-11, bounds).valid);
  assert.ok(!validateCandidate(132.5, .6 - 1e-7, bounds).valid);
  assert.ok(!validateCandidate(132.5, -1e-11, bounds).valid);
  assert.ok(!validateCandidate(NaN, .6, bounds).valid);
  assert.ok(!validateCandidate(140, .6, { minAdr: 150, maxAdr: 130 }).valid);
  assert.ok(!validateCandidate(140, .6, { ...bounds, minOccupancy: 1.1 }).valid);
});
test('Hazır olmayan veri ile simülasyon sonucu veya eğri üretilmez', () => {
  for (const input of [{ ...readyCase(), demand: undefined }, { ...readyCase(), referenceOccupancy: 1.1 }]) {
    const result = simulatePrice(input, 145);
    assert.equal(result.selected, undefined);
    assert.equal(result.curve, undefined);
  }
});
test('Simülasyon fiyatı skills üzerinden doğru hesaplanır', () => {
  const result = simulatePrice(readyCase(), 141.25);
  assert.ok(result.selected);
  assert.ok(Math.abs(result.selected.occupancy - .565) < 1e-12);
  assert.ok(Math.abs(result.selected.revpar - 79.80625) < 1e-12);
  assert.ok(result.selected.feasible);
  assert.equal(result.curve?.[0].adr, 130);
  assert.equal(result.curve?.at(-1)?.adr, 150);
});
test('Simülasyonda kısıt ihlali açık görünür; fiyat dışı sonuç hesaplanmaz', () => {
  const result = simulatePrice({ ...readyCase(), minOccupancy: .6 }, 145);
  assert.equal(result.selected?.feasible, false);
  assert.equal(result.selected?.constraints.issues[0].code, 'MIN_OCCUPANCY_VIOLATION');
  const outside = simulatePrice(readyCase(), 160);
  assert.equal(outside.selected, undefined);
  assert.equal(outside.issues[0].code, 'OUTSIDE_DEMAND_DOMAIN');
});
test('Simülasyon tek fiyatı ve senaryo segmentlerini korur', () => {
  assert.equal(simulatePrice({ ...readyCase(), minAdr: 145, maxAdr: 145 }, 145).curve?.length, 1);
  const input = { ...readyCase(), referenceAdr: undefined, referenceOccupancy: undefined, demand: { kind: 'scenario-points', modelVersion: 'demand.v1', points: [{ adr: 130, occupancy: .65 }, { adr: 143, occupancy: .57 }, { adr: 150, occupancy: .5 }] } };
  assert.ok(simulatePrice(input, 140).curve?.some(p => p.adr === 143));
});
