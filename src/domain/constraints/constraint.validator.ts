import { nearlyEqual, ratioEqual } from '../numerics/numerical-policy.ts';
import type { Issue } from '../case/case.types.ts';

export type CandidateConstraints = Readonly<{ minAdr: number; maxAdr: number; minOccupancy?: number }>;
export type ConstraintResult = Readonly<{
  valid: boolean; issues: readonly Issue[];
  bindingConstraints: readonly ('minAdr' | 'maxAdr' | 'minOccupancy' | 'zeroOccupancy' | 'fullOccupancy')[];
}>;

/** External bounds are strict; calculated candidates use the versioned comparison policy. */
export function validateCandidate(adr: number, occupancy: number, bounds: CandidateConstraints): ConstraintResult {
  const issues: Issue[] = [];
  const bindingConstraints: ConstraintResult['bindingConstraints'][number][] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (!bounds || !Number.isFinite(bounds.minAdr) || !Number.isFinite(bounds.maxAdr) || bounds.minAdr <= 0 || bounds.minAdr > bounds.maxAdr) add('INVALID_ADR_RANGE', 'bounds', 'Geçerli pozitif fiyat aralığı gerekli.');
  if (bounds?.minOccupancy !== undefined && (!Number.isFinite(bounds.minOccupancy) || bounds.minOccupancy < 0 || bounds.minOccupancy > 1)) add('INVALID_OCCUPANCY', 'minOccupancy', 'Minimum doluluk 0–1 oranı olmalı.');
  if (!Number.isFinite(adr) || adr <= 0) add('INVALID_NUMBER', 'adr', 'ADR sonlu ve pozitif olmalı.');
  if (!Number.isFinite(occupancy) || occupancy < 0 || occupancy > 1) add('INVALID_OCCUPANCY', 'occupancy', 'Doluluk 0–1 oranı olmalı.');
  if (issues.length) return { valid: false, issues, bindingConstraints };
  if (adr < bounds.minAdr && !nearlyEqual(adr, bounds.minAdr)) add('ADR_BELOW_MIN', 'adr', 'Fiyat minimum ADR sınırının altında.');
  if (adr > bounds.maxAdr && !nearlyEqual(adr, bounds.maxAdr)) add('ADR_ABOVE_MAX', 'adr', 'Fiyat maksimum ADR sınırının üstünde.');
  if (bounds.minOccupancy !== undefined && occupancy < bounds.minOccupancy && !ratioEqual(occupancy, bounds.minOccupancy)) add('MIN_OCCUPANCY_VIOLATION', 'occupancy', 'Beklenen doluluk minimum doluluk şartını karşılamıyor.');
  if (nearlyEqual(adr, bounds.minAdr)) bindingConstraints.push('minAdr');
  if (nearlyEqual(adr, bounds.maxAdr)) bindingConstraints.push('maxAdr');
  if (bounds.minOccupancy !== undefined && ratioEqual(occupancy, bounds.minOccupancy)) bindingConstraints.push('minOccupancy');
  if (ratioEqual(occupancy, 0)) bindingConstraints.push('zeroOccupancy');
  if (ratioEqual(occupancy, 1)) bindingConstraints.push('fullOccupancy');
  // Raw values are never clipped. A binding comparison is limited to the central policy.
  return { valid: issues.length === 0, issues, bindingConstraints };
}
