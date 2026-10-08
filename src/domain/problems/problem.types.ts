import type { ValidatedCase } from '../case/case.types.ts';

export type MaxRevparProblem = Readonly<{
  problemVersion: 'max-revpar.v1';
  caseSnapshot: ValidatedCase;
  objective: Readonly<{ metric: 'revpar'; direction: 'max' }>;
  decision: Readonly<{ metric: 'adr'; min: number; max: number }>;
  constraints: Readonly<{ occupancyMin: number; occupancyMax: 1 }>;
  calculationVersion: 'revpar.v1';
  solverVersion: 'max-revpar-solver.v1';
  numericalPolicyVersion: 'numerics.v1';
}>;
