import { checkMaxRevparReadiness } from '../readiness/readiness.engine.ts';
import type { ReadinessResult } from '../readiness/readiness.engine.ts';
import type { Issue } from '../case/case.types.ts';
import { validateMaxRevparProblem } from './problem.schema.ts';
import { MAX_REVPAR_VERSIONS } from './problem.versions.ts';
import type { MaxRevparProblem } from './problem.types.ts';

export type ProblemBuildResult =
  | Readonly<{ success: true; problem: MaxRevparProblem; readiness: ReadinessResult; issues: readonly [] }>
  | Readonly<{ success: false; readiness: ReadinessResult; issues: readonly Issue[] }>;

/** Always recomputes readiness; callers cannot supply a stale or fabricated READY flag. */
export function buildMaxRevparProblem(input: unknown): ProblemBuildResult {
  const readiness = checkMaxRevparReadiness(input);
  if (readiness.status !== 'READY' || !readiness.caseSnapshot) return {
    success: false, readiness,
    issues: [...readiness.issues, ...readiness.missingFields.map(field => ({ code: 'REQUIRED_FIELD', path: field.path, message: field.reason }))],
  };
  const snapshot = readiness.caseSnapshot;
  const parsed = validateMaxRevparProblem({
    problemVersion: MAX_REVPAR_VERSIONS.problemVersion,
    caseSnapshot: snapshot,
    objective: { metric: 'revpar', direction: 'max' },
    decision: { metric: 'adr', min: snapshot.minAdr, max: snapshot.maxAdr },
    constraints: { occupancyMin: snapshot.minOccupancy ?? 0, occupancyMax: 1 },
    calculationVersion: MAX_REVPAR_VERSIONS.calculationVersion,
    solverVersion: MAX_REVPAR_VERSIONS.solverVersion,
    numericalPolicyVersion: MAX_REVPAR_VERSIONS.numericalPolicyVersion,
  });
  if (!parsed.success) return { success: false, readiness, issues: parsed.issues };
  return { success: true, problem: parsed.data, readiness, issues: [] };
}
