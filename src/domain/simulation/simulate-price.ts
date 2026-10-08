import { checkMaxRevparReadiness } from '../readiness/readiness.engine.ts';
import type { ReadinessResult } from '../readiness/readiness.engine.ts';
import { compileDemand } from '../skills/demand.skill.ts';
import { calculateRevpar } from '../skills/revpar.skill.ts';
import { validateCandidate } from '../constraints/constraint.validator.ts';
import type { ConstraintResult } from '../constraints/constraint.validator.ts';
import type { Issue } from '../case/case.types.ts';

export type SimulationPoint = Readonly<{ adr: number; occupancy: number; revpar: number; feasible: boolean }>;
export type SimulationResult = Readonly<{
  readiness: ReadinessResult;
  issues: readonly Issue[];
  selected?: SimulationPoint & Readonly<{ constraints: ConstraintResult }>;
  curve?: readonly SimulationPoint[];
}>;

/** A single-price what-if; never searches or claims an optimum. */
export function simulatePrice(input: unknown, adr: number): SimulationResult {
  const readiness = checkMaxRevparReadiness(input);
  if (readiness.status !== 'READY' || !readiness.caseSnapshot) return { readiness, issues: [] };
  const snapshot = readiness.caseSnapshot;
  const compiled = compileDemand(snapshot);
  if (!compiled.success) return { readiness, issues: compiled.issues };
  const model = compiled.value;
  const occupancy = model.occupancyAt(adr);
  if (!occupancy.success) return { readiness, issues: occupancy.issues };
  const revpar = calculateRevpar(adr, occupancy.value);
  if (!revpar.success) return { readiness, issues: revpar.issues };
  const bounds = { minAdr: snapshot.minAdr, maxAdr: snapshot.maxAdr, minOccupancy: snapshot.minOccupancy };
  const constraints = validateCandidate(adr, occupancy.value, bounds);
  const prices = new Set<number>([snapshot.minAdr, snapshot.maxAdr, adr]);
  for (const segment of model.segments) { prices.add(segment.minAdr); prices.add(segment.maxAdr); }
  for (let i = 1; i < 80; i++) prices.add(snapshot.minAdr + (snapshot.maxAdr - snapshot.minAdr) * i / 80);
  const curve: SimulationPoint[] = [];
  for (const price of [...prices].sort((a, b) => a - b)) {
    const q = model.occupancyAt(price);
    if (!q.success) return { readiness, issues: q.issues };
    const r = calculateRevpar(price, q.value);
    if (!r.success) return { readiness, issues: r.issues };
    curve.push({ adr: price, occupancy: q.value, revpar: r.value, feasible: validateCandidate(price, q.value, bounds).valid });
  }
  return { readiness, issues: [], selected: { adr, occupancy: occupancy.value, revpar: revpar.value, feasible: constraints.valid, constraints }, curve };
}
