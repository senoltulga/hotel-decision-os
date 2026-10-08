import type { ScenarioRequest, ScenarioResult } from '../simulation/scenario.engine.ts';
import { evaluateScenario, applyScenarioPatches } from '../simulation/scenario.engine.ts';
import type { Patch } from '../simulation/scenario.engine.ts';
import { attempt, finite, nonnegative, ratio, FinancialInputError, unwrap } from '../skills/financial.skills.ts';
import { nearlyEqual } from '../numerics/numerical-policy.ts';
import type { SkillResult } from '../skills/skill.types.ts';

export type Objective = Readonly<{ metric: string; direction: 'MAX' | 'MIN' }>;
export type MetricConstraint = Readonly<{ metric: string; operator: '>=' | '<='; value: number }>;
export type DecisionOption = Readonly<{ name: string; patches: readonly Patch[]; riskScore: number; serviceQuality: number }>;
export type EvaluatedOption = Readonly<{ option: DecisionOption; scenario: ScenarioResult; metrics: Readonly<Record<string, number | null>>; feasible: boolean; violations: readonly string[] }>;
// Exogenous discount/cap/growth/tax rates and the demand model can vary in simulation,
// but are fixed across decision optimization. Relationships must be supplied explicitly.
const decisionPaths = new Set(['adr', 'financialCase.capacity.openDays', 'financialCase.costs.fixedOpex', 'financialCase.costs.variablePerOccupiedRoomNight', 'financialCase.costs.propertyExpenses', 'financialCase.finance.initialInvestment']);
export function evaluateDecisionOptions(base: ScenarioRequest, options: readonly DecisionOption[], constraints: readonly MetricConstraint[]): SkillResult<readonly EvaluatedOption[]> {
  return attempt(() => {
    if (!Array.isArray(options) || options.length < 1 || options.length > 10000) throw new FinancialInputError('INVALID_OPTIONS', 'options', '1–10000 açık karar alternatifi gerekli.');
    if (new Set(options.map(option => option.name)).size !== options.length) throw new FinancialInputError('DUPLICATE_OPTION', 'options', 'Alternatif isimleri benzersiz olmalı.');
    for (const constraint of constraints) { finite(constraint.value, constraint.metric); if (!['>=', '<='].includes(constraint.operator)) throw new FinancialInputError('INVALID_CONSTRAINT', constraint.metric, 'Kısıt operatörü >= veya <= olmalı.'); }
    return options.map(option => {
      if (!option.name?.trim()) throw new FinancialInputError('REQUIRED_FIELD', 'option.name', 'Alternatif adı gerekli.');
      ratio(option.riskScore, 'riskScore'); ratio(option.serviceQuality, 'serviceQuality');
      for (const patch of option.patches) if (!decisionPaths.has(patch.path) && !/^financialCase\.finance\.annualCapex\.\d+$/.test(patch.path)) throw new FinancialInputError('EXOGENOUS_DECISION', patch.path, 'Bu alan karar değişkeni değil; sabit piyasa/talep varsayımı optimizasyonda değiştirilemez.');
      const scenario = unwrap(evaluateScenario(unwrap(applyScenarioPatches(base, option.patches, option.name))));
      const metrics: Record<string, number | null> = { ...scenario.kpis, risk: option.riskScore, serviceQuality: option.serviceQuality };
      const violations = constraints.flatMap(constraint => {
        const value = metrics[constraint.metric]; if (value == null) return [`${constraint.metric}: hesaplanamayan metrik kısıtı karşılamaz.`];
        const pass = constraint.operator === '>=' ? value >= constraint.value || nearlyEqual(value, constraint.value) : value <= constraint.value || nearlyEqual(value, constraint.value);
        return pass ? [] : [`${constraint.metric} ${constraint.operator} ${constraint.value}`];
      });
      return { option: structuredClone(option), scenario, metrics, feasible: scenario.feasible && !violations.length, violations };
    });
  });
}
export function optimizeOptions(base: ScenarioRequest, options: readonly DecisionOption[], objective: Objective, constraints: readonly MetricConstraint[] = []): SkillResult<{
  status: 'OPTIMAL_CANDIDATES' | 'INFEASIBLE'; best: EvaluatedOption | null; alternatives: readonly EvaluatedOption[]; objective: Objective;
}> {
  return attempt(() => {
    if (!['MAX', 'MIN'].includes(objective.direction)) throw new FinancialInputError('INVALID_OBJECTIVE', 'direction', 'MAX veya MIN yönü gerekli.');
    const alternatives = unwrap(evaluateDecisionOptions(base, options, constraints));
    if (!alternatives.some(option => Object.hasOwn(option.metrics, objective.metric))) throw new FinancialInputError('INVALID_OBJECTIVE', 'metric', 'Hedef metriği desteklenmiyor.');
    const feasible = alternatives.filter(option => option.feasible && option.metrics[objective.metric] != null);
    feasible.sort((a, b) => {
      const av = a.metrics[objective.metric]!; const bv = b.metrics[objective.metric]!;
      if (nearlyEqual(av, bv)) return a.option.name < b.option.name ? -1 : a.option.name > b.option.name ? 1 : 0;
      return objective.direction === 'MAX' ? bv - av : av - bv;
    });
    return { status: feasible.length ? 'OPTIMAL_CANDIDATES' : 'INFEASIBLE', best: feasible[0] ?? null, alternatives, objective };
  });
}
export function paretoOptimize(base: ScenarioRequest, options: readonly DecisionOption[], objectives: readonly Objective[], constraints: readonly MetricConstraint[] = []): SkillResult<{ front: readonly EvaluatedOption[]; dominated: readonly EvaluatedOption[]; infeasible: readonly EvaluatedOption[]; objectives: readonly Objective[] }> {
  return attempt(() => {
    if (!Array.isArray(objectives) || objectives.length < 2 || new Set(objectives.map(objective => objective.metric)).size !== objectives.length) throw new FinancialInputError('INVALID_OBJECTIVES', 'objectives', 'En az iki farklı hedef gerekli.');
    const all = unwrap(evaluateDecisionOptions(base, options, constraints));
    for (const objective of objectives) if (!['MAX', 'MIN'].includes(objective.direction) || !all.some(option => Object.hasOwn(option.metrics, objective.metric))) throw new FinancialInputError('INVALID_OBJECTIVE', objective.metric, 'Geçerli hedef/yön gerekli.');
    const feasible = all.filter(option => option.feasible && objectives.every(objective => option.metrics[objective.metric] != null));
    const dominates = (a: EvaluatedOption, b: EvaluatedOption) => {
      let better = false;
      for (const objective of objectives) { const av = a.metrics[objective.metric]!; const bv = b.metrics[objective.metric]!;
        if (nearlyEqual(av, bv)) continue;
        if ((objective.direction === 'MAX' && av < bv) || (objective.direction === 'MIN' && av > bv)) return false;
        better = true;
      }
      return better;
    };
    const front = feasible.filter(option => !feasible.some(other => dominates(other, option)));
    return { front, dominated: feasible.filter(option => !front.includes(option)), infeasible: all.filter(option => !feasible.includes(option)), objectives };
  });
}
export function createPriceOptions(min: number, max: number, step: number, riskScore: number, serviceQuality: number): SkillResult<readonly DecisionOption[]> {
  return attempt(() => { nonnegative(min, 'minAdr'); finite(max, 'maxAdr'); finite(step, 'step'); ratio(riskScore, 'riskScore'); ratio(serviceQuality, 'serviceQuality');
    if (min <= 0 || min > max || step <= 0 || (max - min) / step > 9998) throw new FinancialInputError('INVALID_GRID', 'step', 'Pozitif fiyat adımı ve en fazla 10000 aday gerekli.');
    const count = Math.floor((max - min) / step); const prices = Array.from({ length: count + 1 }, (_, i) => Math.min(max, min + i * step));
    if (prices.at(-1) !== max) prices.push(max);
    return prices.map(adr => ({ name: `ADR ${adr}`, patches: [{ path: 'adr', value: adr }], riskScore, serviceQuality })); });
}
