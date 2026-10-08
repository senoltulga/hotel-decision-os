import { isRecord } from '../case/case.schema.ts';
import { checkMaxRevparReadiness } from '../readiness/readiness.engine.ts';
import type { Issue, ValidationResult } from '../case/case.types.ts';
import type { MaxRevparProblem } from './problem.types.ts';
import { MAX_REVPAR_VERSIONS } from './problem.versions.ts';

export function validateMaxRevparProblem(input: unknown): ValidationResult<MaxRevparProblem> {
  if (!isRecord(input)) return { success: false, issues: [{ code: 'INVALID_PROBLEM', path: '', message: 'Problem nesnesi gerekli.' }] };
  const issues: Issue[] = [];
  const add = (path: string) => issues.push({ code: 'INVALID_PROBLEM', path, message: 'Problem sözleşmesiyle uyuşmuyor.' });
  for (const key of ['problemVersion', 'calculationVersion', 'solverVersion', 'numericalPolicyVersion'] as const) if (input[key] !== MAX_REVPAR_VERSIONS[key]) add(key);
  const readiness = checkMaxRevparReadiness(input.caseSnapshot);
  const snapshot = readiness.status === 'READY' ? readiness.caseSnapshot : undefined;
  if (!snapshot) {
    issues.push(...readiness.issues.map(issue => ({ ...issue, path: `caseSnapshot.${issue.path}` })));
    issues.push(...readiness.missingFields.map(field => ({ code: 'REQUIRED_FIELD', path: `caseSnapshot.${field.path}`, message: field.reason })));
  }
  if (!isRecord(input.objective) || input.objective.metric !== 'revpar' || input.objective.direction !== 'max') add('objective');
  if (!isRecord(input.decision) || input.decision.metric !== 'adr' || !snapshot || input.decision.min !== snapshot.minAdr || input.decision.max !== snapshot.maxAdr) add('decision');
  if (!isRecord(input.constraints) || input.constraints.occupancyMax !== 1 || !snapshot || input.constraints.occupancyMin !== (snapshot.minOccupancy ?? 0)) add('constraints');
  if (issues.length || !snapshot) return { success: false, issues };
  // Build a canonical envelope: imported extra properties cannot become executable state.
  const problem: MaxRevparProblem = {
    problemVersion: MAX_REVPAR_VERSIONS.problemVersion,
    caseSnapshot: snapshot,
    objective: { metric: 'revpar', direction: 'max' },
    decision: { metric: 'adr', min: snapshot.minAdr, max: snapshot.maxAdr },
    constraints: { occupancyMin: snapshot.minOccupancy ?? 0, occupancyMax: 1 },
    calculationVersion: MAX_REVPAR_VERSIONS.calculationVersion,
    solverVersion: MAX_REVPAR_VERSIONS.solverVersion,
    numericalPolicyVersion: MAX_REVPAR_VERSIONS.numericalPolicyVersion,
  };
  return { success: true, data: deepFreeze(problem), issues: [] };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
