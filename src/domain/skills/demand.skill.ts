import { isRecord, validateCase } from '../case/case.schema.ts';
import type { Issue } from '../case/case.types.ts';
import { failure } from './skill.types.ts';
import type { SkillResult } from './skill.types.ts';

export const DEMAND_SKILL_VERSION = 'demand.v1';

export type DemandSegment = Readonly<{
  minAdr: number; maxAdr: number;
  occupancyAtMin: number; occupancyAtMax: number;
}>;

export type CompiledDemand = Readonly<{
  modelVersion: 'demand.v1';
  kind: 'linear-sensitivity' | 'scenario-points';
  minAdr: number; maxAdr: number;
  segments: readonly DemandSegment[];
  occupancyAt: (adr: number) => SkillResult<number>;
}>;

/** Input: { demand, minAdr, maxAdr, referenceAdr?, referenceOccupancy? }.
 * Compilation validates the requested analysis range, not unused model ranges.
 * The closure holds an independent snapshot; no input mutation can alter it.
 */
export function compileDemand(input: unknown): SkillResult<CompiledDemand> {
  if (!isRecord(input)) return failure('INVALID_DEMAND', 'demand', 'Talep girdisi nesne olmalı.');
  const parsed = validateCase({
    schemaVersion: 'case.v1', id: 'demand-validation', revision: 0,
    demand: input.demand, minAdr: input.minAdr, maxAdr: input.maxAdr,
    referenceAdr: input.referenceAdr, referenceOccupancy: input.referenceOccupancy,
  });
  if (!parsed.success) return { success: false, issues: parsed.issues };
  const data = parsed.data;
  const missing: Issue[] = [];
  for (const key of ['demand', 'minAdr', 'maxAdr'] as const) {
    if (data[key] === undefined) missing.push({ code: 'REQUIRED_FIELD', path: key, message: 'Talep hesabı için alan gerekli.' });
  }
  if (data.demand?.kind === 'linear-sensitivity') {
    for (const key of ['referenceAdr', 'referenceOccupancy'] as const) {
      if (data[key] === undefined) missing.push({ code: 'REQUIRED_FIELD', path: key, message: 'Doğrusal model için referans gerekli.' });
    }
  }
  if (missing.length) return { success: false, issues: missing };
  const demand = data.demand!;
  const minAdr = data.minAdr!;
  const maxAdr = data.maxAdr!;
  let segments: DemandSegment[];
  let evaluate: (adr: number) => number;
  if (demand.kind === 'linear-sensitivity') {
    const slope = (demand.occupancyDecreasePp / 100) / demand.adrIncrease;
    if (!Number.isFinite(slope)) return failure('NUMERICAL_ERROR', 'demand', 'Duyarlılık katsayısı hesaplanamadı.');
    const referenceAdr = data.referenceAdr!;
    const referenceOccupancy = data.referenceOccupancy!;
    evaluate = adr => referenceOccupancy - slope * (adr - referenceAdr);
    segments = [{ minAdr, maxAdr, occupancyAtMin: evaluate(minAdr), occupancyAtMax: evaluate(maxAdr) }];
  } else {
    const points = demand.points;
    const interpolate = (adr: number, left: typeof points[number], right: typeof points[number]) => {
      if (adr === left.adr) return left.occupancy;
      if (adr === right.adr) return right.occupancy;
      const fraction = (adr - left.adr) / (right.adr - left.adr);
      return left.occupancy + fraction * (right.occupancy - left.occupancy);
    };
    evaluate = adr => {
      for (let i = 1; i < points.length; i++) {
        if (adr <= points[i].adr) return interpolate(adr, points[i - 1], points[i]);
      }
      return Number.NaN; // Guarded by the requested/model domain checks.
    };
    segments = [];
    for (let i = 1; i < points.length; i++) {
      const left = Math.max(minAdr, points[i - 1].adr);
      const right = Math.min(maxAdr, points[i].adr);
      if (left <= right) segments.push({ minAdr: left, maxAdr: right, occupancyAtMin: interpolate(left, points[i - 1], points[i]), occupancyAtMax: interpolate(right, points[i - 1], points[i]) });
    }
  }
  for (const segment of segments) {
    for (const occupancy of [segment.occupancyAtMin, segment.occupancyAtMax]) {
      if (!Number.isFinite(occupancy)) return failure('NUMERICAL_ERROR', 'demand', 'Talep hesabı sonlu sonuç üretmedi.');
      if (occupancy < 0 || occupancy > 1) return failure('INVALID_OCCUPANCY', 'demand', 'Model analiz aralığında 0–1 dışında doluluk üretiyor; fiyat aralığını veya modeli düzeltin.');
    }
  }
  const occupancyAt = (adr: number): SkillResult<number> => {
    if (!Number.isFinite(adr) || adr <= 0) return failure('INVALID_NUMBER', 'adr', 'ADR sonlu ve pozitif olmalı.');
    if (adr < minAdr || adr > maxAdr) return failure('OUTSIDE_DEMAND_DOMAIN', 'adr', 'Fiyat derlenen analiz aralığının dışında; ekstrapolasyon yapılmaz.');
    const value = evaluate(adr);
    if (!Number.isFinite(value)) return failure('NUMERICAL_ERROR', 'demand', 'Talep hesabı sonlu sonuç üretmedi.');
    if (value < 0 || value > 1) return failure('INVALID_OCCUPANCY', 'demand', 'Doluluk 0–1 aralığı dışında; kırpma yapılmaz.');
    return { success: true, value };
  };
  return { success: true, value: Object.freeze({ modelVersion: DEMAND_SKILL_VERSION, kind: demand.kind, minAdr, maxAdr,
    segments: Object.freeze(segments.map(segment => Object.freeze(segment))), occupancyAt }) };
}
