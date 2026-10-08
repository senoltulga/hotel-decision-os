import { failure } from './skill.types.ts';
import type { SkillResult } from './skill.types.ts';

export const REVPAR_SKILL_VERSION = 'revpar.v1';

/** ADR and output share the caller's currency. Occupancy is a ratio, not a percent. */
export function calculateRevpar(adr: number, occupancy: number): SkillResult<number> {
  if (!Number.isFinite(adr) || adr <= 0) return failure('INVALID_NUMBER', 'adr', 'ADR sonlu ve pozitif olmalı.');
  if (!Number.isFinite(occupancy) || occupancy < 0 || occupancy > 1) return failure('INVALID_OCCUPANCY', 'occupancy', 'Doluluk 0–1 oranı olmalı.');
  const value = adr * occupancy;
  if (!Number.isFinite(value)) return failure('NUMERICAL_ERROR', 'revpar', 'RevPAR sonlu değil.');
  return { success: true, value };
}
