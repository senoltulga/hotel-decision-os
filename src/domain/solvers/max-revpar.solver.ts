import { validateMaxRevparProblem } from '../problems/problem.schema.ts';
import type { MaxRevparProblem } from '../problems/problem.types.ts';
import type { Issue } from '../case/case.types.ts';
import { compileDemand } from '../skills/demand.skill.ts';
import { calculateRevpar } from '../skills/revpar.skill.ts';
import { validateCandidate } from '../constraints/constraint.validator.ts';
import type { ConstraintResult } from '../constraints/constraint.validator.ts';
import { nearlyEqual, ratioEqual } from '../numerics/numerical-policy.ts';

export type RevparSolution = Readonly<{
  status: 'OPTIMAL'; optimalAdr: number; expectedOccupancy: number; maximumRevpar: number;
  bindingConstraints: ConstraintResult['bindingConstraints']; candidateCount: number;
  inputSnapshot: MaxRevparProblem;
}> | Readonly<{ status: 'INFEASIBLE' | 'INVALID_PROBLEM' | 'NUMERICAL_ERROR'; issues: readonly Issue[] }>;

/** Exact analytic candidates for the supported continuous piecewise-linear models. */
export function solveMaxRevpar(input: unknown): RevparSolution {
  const parsed = validateMaxRevparProblem(input);
  if (!parsed.success) return { status: 'INVALID_PROBLEM', issues: parsed.issues };
  const problem = parsed.data;
  const compiled = compileDemand(problem.caseSnapshot);
  if (!compiled.success) return { status: 'INVALID_PROBLEM', issues: compiled.issues };
  const bounds = { minAdr: problem.decision.min, maxAdr: problem.decision.max, minOccupancy: problem.constraints.occupancyMin };
  const candidates = new Set<number>();
  for (const segment of compiled.value.segments) {
    const { minAdr: low, maxAdr: high, occupancyAtMin: qLow, occupancyAtMax: qHigh } = segment;
    if (qLow < bounds.minOccupancy && !ratioEqual(qLow, bounds.minOccupancy)) continue;
    let feasibleHigh = high;
    if (qHigh < bounds.minOccupancy && qLow !== qHigh) feasibleHigh = low + (high - low) * ((qLow - bounds.minOccupancy) / (qLow - qHigh));
    feasibleHigh = Math.min(high, Math.max(low, feasibleHigh));
    candidates.add(low); candidates.add(feasibleHigh);
    if (high > low && qLow > qHigh) {
      // p* = (qLow / k + low) / 2; stable centered representation.
      const inverseSlope = (high - low) / (qLow - qHigh);
      const stationary = (qLow * inverseSlope + low) / 2;
      if (Number.isFinite(stationary) && stationary >= low && stationary <= feasibleHigh) candidates.add(stationary);
    }
  }
  let best: { adr: number; occupancy: number; revpar: number; constraints: ConstraintResult } | undefined;
  let candidateCount = 0;
  for (const adr of [...candidates].sort((a, b) => a - b)) {
    const q = compiled.value.occupancyAt(adr);
    if (!q.success) return { status: 'NUMERICAL_ERROR', issues: q.issues };
    const constraints = validateCandidate(adr, q.value, bounds);
    if (!constraints.valid) continue;
    const r = calculateRevpar(adr, q.value);
    if (!r.success) return { status: 'NUMERICAL_ERROR', issues: r.issues };
    candidateCount++;
    if (!best || (r.value > best.revpar && !nearlyEqual(r.value, best.revpar)) || (nearlyEqual(r.value, best.revpar) && adr < best.adr)) best = { adr, occupancy: q.value, revpar: r.value, constraints };
  }
  if (!best) return { status: 'INFEASIBLE', issues: [{ code: 'NO_FEASIBLE_PRICE', path: 'constraints', message: 'Talep modeli ve doluluk şartları altında uygulanabilir fiyat yok.' }] };
  return Object.freeze({ status: 'OPTIMAL', optimalAdr: best.adr, expectedOccupancy: best.occupancy, maximumRevpar: best.revpar,
    bindingConstraints: best.constraints.bindingConstraints, candidateCount, inputSnapshot: problem });
}
