import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileDemand } from '../../src/domain/skills/demand.skill.ts';
import { calculateRevpar } from '../../src/domain/skills/revpar.skill.ts';
import type { SkillResult } from '../../src/domain/skills/skill.types.ts';

function value<T>(result: SkillResult<T>): T {
  assert.ok(result.success, JSON.stringify(result));
  return result.value;
}
function fails(result: SkillResult<unknown>, code: string) {
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.issues.some(issue => issue.code === code), JSON.stringify(result));
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≠ ${expected}`);
const linear = () => ({ minAdr: 130, maxAdr: 150, referenceAdr: 145, referenceOccupancy: .55,
  demand: { kind: 'linear-sensitivity', modelVersion: 'demand.v1', adrIncrease: 5, occupancyDecreasePp: 2, validMinAdr: 130, validMaxAdr: 150 } });
const points = () => ({ minAdr: 130, maxAdr: 150, demand: { kind: 'scenario-points', modelVersion: 'demand.v1',
  points: [{ adr: 150, occupancy: .50 }, { adr: 130, occupancy: .65 }, { adr: 145, occupancy: .55 }] } });

test('RevPAR: bağımsız referans hesabı ve ham hassasiyet', () => {
  assert.equal(value(calculateRevpar(145, .55)), 79.75);
  close(value(calculateRevpar(141.25, .565)), 79.80625);
  assert.equal(value(calculateRevpar(150, 0)), 0);
  assert.equal(value(calculateRevpar(150, 1)), 150);
});
test('RevPAR: geçersiz fiyatlar, yüzde formatı ve sonlu olmayan veri reddedilir', () => {
  for (const adr of [0, -1, Infinity, NaN]) fails(calculateRevpar(adr, .55), 'INVALID_NUMBER');
  for (const occupancy of [-.1, 1.01, 55, Infinity, NaN]) fails(calculateRevpar(145, occupancy), 'INVALID_OCCUPANCY');
});
test('Doğrusal model: referans, aralık uçları ve iç nokta', () => {
  const model = value(compileDemand(linear()));
  close(value(model.occupancyAt(130)), .61);
  close(value(model.occupancyAt(145)), .55);
  close(value(model.occupancyAt(150)), .53);
  close(value(model.occupancyAt(141.25)), .565);
  close(value(calculateRevpar(141.25, value(model.occupancyAt(141.25)))), 79.80625);
});
test('Yüzde puanı düşüşü göreli yüzde düşüşüne dönüştürülmez', () => {
  close(value(value(compileDemand(linear())).occupancyAt(150)), .53);
});
test('Sabit doluluk ve tek fiyat aralığı desteklenir', () => {
  const input = linear(); input.demand.occupancyDecreasePp = 0;
  const constant = value(compileDemand(input));
  close(value(constant.occupancyAt(130)), .55);
  close(value(constant.occupancyAt(150)), .55);
  const single = value(compileDemand({ ...linear(), minAdr: 145, maxAdr: 145 }));
  close(value(single.occupancyAt(145)), .55);
  assert.equal(single.segments[0].minAdr, single.segments[0].maxAdr);
});
test('Eksik model, sınır ve doğrusal referanslar reddedilir', () => {
  for (const key of ['demand', 'minAdr', 'maxAdr', 'referenceAdr', 'referenceOccupancy']) fails(compileDemand({ ...linear(), [key]: undefined }), 'REQUIRED_FIELD');
  fails(compileDemand(null), 'INVALID_DEMAND');
});
test('Model ve fiyat alanı dışında değerlendirme yapılmaz', () => {
  fails(compileDemand({ ...linear(), minAdr: 120 }), 'OUTSIDE_DEMAND_DOMAIN');
  const model = value(compileDemand(linear()));
  for (const adr of [129.99, 150.01]) fails(model.occupancyAt(adr), 'OUTSIDE_DEMAND_DOMAIN');
  for (const adr of [0, NaN, Infinity]) fails(model.occupancyAt(adr), 'INVALID_NUMBER');
});
test('Uçlarda fiziksel sınır ihlali sessizce kırpılmaz', () => {
  fails(compileDemand({ ...linear(), referenceOccupancy: .99 }), 'INVALID_OCCUPANCY');
  fails(compileDemand({ ...linear(), referenceOccupancy: .01 }), 'INVALID_OCCUPANCY');
});
test('Yalnızca istenen analiz aralığı fiziksel olarak doğrulanır', () => {
  const input = linear(); input.demand.validMinAdr = 1;
  assert.ok(compileDemand(input).success);
});
test('Sayısal taşma başarıya çevrilmez', () => {
  const input = linear(); input.demand.adrIncrease = Number.MIN_VALUE;
  fails(compileDemand(input), 'NUMERICAL_ERROR');
});
test('Senaryo noktaları: referanssız interpolasyon ve her segment ucu', () => {
  const model = value(compileDemand(points()));
  for (const [adr, expected] of [[130, .65], [137.5, .60], [145, .55], [147.5, .525], [150, .50]]) close(value(model.occupancyAt(adr)), expected);
  assert.equal(model.segments.length, 2);
  close(value(calculateRevpar(130, value(model.occupancyAt(130)))), 84.5);
});
test('Senaryo modelinde kırpılmış segmentler ve tek fiyat', () => {
  const model = value(compileDemand({ ...points(), minAdr: 140, maxAdr: 148 }));
  assert.equal(model.segments[0].minAdr, 140);
  assert.equal(model.segments[1].maxAdr, 148);
  close(value(model.occupancyAt(148)), .52);
  close(value(value(compileDemand({ ...points(), minAdr: 145, maxAdr: 145 })).occupancyAt(145)), .55);
});
test('Senaryo noktalarında fiziksel 0 ve 1 sınırları', () => {
  const model = value(compileDemand({ minAdr: 100, maxAdr: 200, demand: { kind: 'scenario-points', modelVersion: 'demand.v1', points: [{ adr: 100, occupancy: 1 }, { adr: 200, occupancy: 0 }] } }));
  assert.equal(value(model.occupancyAt(100)), 1);
  assert.equal(value(model.occupancyAt(200)), 0);
  assert.equal(value(model.occupancyAt(150)), .5);
});
test('Bağımsız segment örneği: 100/.8 ve 200/.2 için ara değer', () => {
  const model = value(compileDemand({ minAdr: 100, maxAdr: 200, demand: { kind: 'scenario-points', modelVersion: 'demand.v1', points: [{ adr: 100, occupancy: .8 }, { adr: 200, occupancy: .2 }] } }));
  close(value(model.occupancyAt(150)), .5);
  close(value(calculateRevpar(150, value(model.occupancyAt(150)))), 75);
});
test('Geçersiz nokta modelleri ve ekstrapolasyon reddedilir', () => {
  const input = points();
  fails(compileDemand({ ...input, minAdr: 120 }), 'OUTSIDE_DEMAND_DOMAIN');
  fails(compileDemand({ ...input, demand: { ...input.demand, points: [{ adr: 130, occupancy: .5 }, { adr: 130, occupancy: .5 }] } }), 'DUPLICATE_ADR_POINT');
  fails(compileDemand({ ...input, demand: { ...input.demand, points: [{ adr: 130, occupancy: .5 }, { adr: 150, occupancy: .6 }] } }), 'NON_MONOTONE_DEMAND');
  fails(compileDemand({ ...input, demand: { ...input.demand, points: [{ adr: 130, occupancy: 1.5 }, { adr: 150, occupancy: .5 }] } }), 'INVALID_POINT');
  fails(compileDemand({ ...input, demand: { ...input.demand, modelVersion: 'demand.v2' } }), 'UNSUPPORTED_MODEL_VERSION');
});
test('Snapshot, deterministik tekrar ve girdi mutasyonu', () => {
  const input = points(); const model = value(compileDemand(input));
  const before = value(model.occupancyAt(140));
  input.demand.points[1].occupancy = 0;
  assert.equal(value(model.occupancyAt(140)), before);
  assert.ok(Object.isFrozen(model) && Object.isFrozen(model.segments[0]));
  for (let i = 0; i < 10; i++) assert.equal(value(value(compileDemand(points())).occupancyAt(140)), before);
});
test('Segment içindeki doluluk monoton ve fiziksel sınırlar içinde kalır', () => {
  for (const model of [value(compileDemand(linear())), value(compileDemand(points()))]) {
    let previous = 1;
    for (let adr = 130; adr <= 150; adr += .25) {
      const q = value(model.occupancyAt(adr));
      assert.ok(q >= 0 && q <= 1 && q <= previous);
      previous = q;
    }
  }
});
