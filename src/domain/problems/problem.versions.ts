import { DEMAND_SKILL_VERSION } from '../skills/demand.skill.ts';
import { REVPAR_SKILL_VERSION } from '../skills/revpar.skill.ts';
import { NUMERICAL_POLICY } from '../numerics/numerical-policy.ts';

// The solver version is its target contract; no solver is implemented in T04.
export const MAX_REVPAR_VERSIONS = Object.freeze({
  problemVersion: 'max-revpar.v1' as const,
  demandVersion: DEMAND_SKILL_VERSION,
  calculationVersion: REVPAR_SKILL_VERSION,
  solverVersion: 'max-revpar-solver.v1' as const,
  numericalPolicyVersion: NUMERICAL_POLICY.version,
});
