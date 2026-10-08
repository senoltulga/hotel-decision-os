import { evaluateOperatingCase, evaluateInvestmentCase } from '../finance/financial.engine.ts';
import { calculateDirectCapitalization } from '../skills/valuation.skills.ts';
import { attempt, finite, unwrap, FinancialInputError } from '../skills/financial.skills.ts';
import type { FinancialCase } from '../finance/finance.types.ts';
import type { OperatingResult, InvestmentResult } from '../finance/financial.engine.ts';
import type { SkillResult } from '../skills/skill.types.ts';

export type ScenarioRequest = Readonly<{ name: string; financialCase: FinancialCase; adr: number; depth: 'operating' | 'investment' }>;
export type ScenarioResult = Readonly<{ name: string; inputSnapshot: ScenarioRequest; calculation: OperatingResult | InvestmentResult; kpis: Readonly<Record<string, number | null>>; feasible: boolean }>;
export type Patch = Readonly<{ path: string; value: number }>;
export const SCENARIO_PATCH_PATHS = Object.freeze([
  'adr', 'financialCase.case.referenceAdr', 'financialCase.case.referenceOccupancy', 'financialCase.case.minAdr', 'financialCase.case.maxAdr', 'financialCase.case.minOccupancy',
  'financialCase.case.demand.adrIncrease', 'financialCase.case.demand.occupancyDecreasePp', 'financialCase.case.demand.validMinAdr', 'financialCase.case.demand.validMaxAdr',
  'financialCase.capacity.openDays', 'financialCase.capacity.roomCount', 'financialCase.capacity.unavailableRoomNights',
  'financialCase.costs.fixedOpex', 'financialCase.costs.variablePerOccupiedRoomNight', 'financialCase.costs.variableRevenueRate', 'financialCase.costs.managementFeeRate', 'financialCase.costs.propertyExpenses', 'financialCase.costs.nonOperatingIncome', 'financialCase.costs.replacementReserveRate',
  'financialCase.finance.discountRate', 'financialCase.finance.capRate', 'financialCase.finance.revenueGrowth', 'financialCase.finance.costGrowth', 'financialCase.finance.taxRate', 'financialCase.finance.initialInvestment',
  'financialCase.finance.terminal.exitCapRate', 'financialCase.finance.terminal.noiGrowth', 'financialCase.finance.terminal.sellingCostRate', 'financialCase.finance.terminal.growth', 'financialCase.finance.terminal.amount',
]);
export function evaluateScenario(input: ScenarioRequest): SkillResult<ScenarioResult> {
  return attempt(() => {
    if (typeof input.name !== 'string' || !input.name.trim()) throw new FinancialInputError('REQUIRED_FIELD', 'name', 'Senaryo adı gerekli.');
    if (!['operating', 'investment'].includes(input.depth)) throw new FinancialInputError('INVALID_DEPTH', 'depth', 'Operating veya investment analiz derinliği gerekli.');
    const calculation = unwrap(input.depth === 'operating' ? evaluateOperatingCase(input.financialCase, input.adr) : evaluateInvestmentCase(input.financialCase, input.adr));
    const m = calculation.metrics;
    const kpis: Record<string, number | null> = { ...m, occupancy: m.occupancy, value: null };
    if (input.depth === 'investment') {
      const investment = calculation as InvestmentResult;
      Object.assign(kpis, { npv: investment.npv, value: investment.dcfValue, dcfValue: investment.dcfValue, irr: investment.irr.rate, payback: investment.payback.years,
        capex: input.financialCase.finance.initialInvestment + input.financialCase.finance.annualCapex.reduce((sum, value) => sum + value, 0),
        dscr: investment.annual.some(year => year.dscr !== null) ? Math.min(...investment.annual.flatMap(year => year.dscr === null ? [] : [year.dscr])) : null,
        directCapitalizationValue: investment.directCapitalizationValue });
    } else if (input.financialCase.finance?.capRate !== undefined) {
      const direct = calculateDirectCapitalization(m.noi, input.financialCase.finance.capRate); kpis.value = direct.success ? direct.value : null;
    }
    return { name: input.name, inputSnapshot: structuredClone(input), calculation, kpis, feasible: calculation.constraints.valid };
  });
}
export function applyScenarioPatches(base: ScenarioRequest, patches: readonly Patch[], name = base.name): SkillResult<ScenarioRequest> {
  return attempt(() => {
    const result = structuredClone(base) as unknown as Record<string, unknown>;
    if (!Array.isArray(patches)) throw new FinancialInputError('INVALID_PATCH', 'patches', 'Değişiklik dizisi gerekli.');
    for (const patch of patches) {
      if (!SCENARIO_PATCH_PATHS.includes(patch.path) && !/^financialCase\.(?:case\.demand\.points\.\d+\.occupancy|finance\.(?:annualCapex|workingCapitalChanges|annualDebtService)\.\d+)$/.test(patch.path)) throw new FinancialInputError('INVALID_PATCH', patch.path, 'Bu alan senaryo değişikliğini desteklemiyor.');
      finite(patch.value, patch.path);
      const keys = patch.path.split('.'); const leaf = keys.pop()!;
      let target = result;
      for (const key of keys) {
        const next = target[key]; if (typeof next !== 'object' || next === null) throw new FinancialInputError('INVALID_PATCH', patch.path, 'Değiştirilecek model alanı mevcut değil.');
        target = next as Record<string, unknown>;
      }
      if (Array.isArray(target) && (!/^\d+$/.test(leaf) || Number(leaf) >= target.length)) throw new FinancialInputError('INVALID_PATCH', patch.path, 'Plan dizisinde mevcut yıl indeksi gerekli.');
      target[leaf] = patch.value;
    }
    result.name = name;
    return result as unknown as ScenarioRequest;
  });
}
export function runWhatIf(base: ScenarioRequest, patches: readonly Patch[]): SkillResult<{ base: ScenarioResult; alternative: ScenarioResult; delta: Record<string, number | null> }> {
  return attempt(() => {
    const original = unwrap(evaluateScenario(base)); const alternative = unwrap(evaluateScenario(unwrap(applyScenarioPatches(base, patches, 'What-if'))));
    const delta = Object.fromEntries(Object.keys(original.kpis).map(metric => [metric, original.kpis[metric] !== null && alternative.kpis[metric] !== null ? alternative.kpis[metric]! - original.kpis[metric]! : null]));
    return { base: original, alternative, delta };
  });
}
export function compareAlternatives(a: ScenarioRequest, b: ScenarioRequest): SkillResult<{ alternatives: readonly ScenarioResult[]; deltaBvsA: Record<string, number | null> }> {
  return attempt(() => { if (a.financialCase.case.currency !== b.financialCase.case.currency || a.financialCase.case.period?.start !== b.financialCase.case.period?.start || a.financialCase.case.period?.end !== b.financialCase.case.period?.end || a.depth !== b.depth) throw new FinancialInputError('INCOMPARABLE', 'alternatives', 'A/B aynı dönem, para birimi ve analiz derinliğinde olmalı.');
    const av = unwrap(evaluateScenario(a)); const bv = unwrap(evaluateScenario(b));
    return { alternatives: [av, bv], deltaBvsA: Object.fromEntries(Object.keys(av.kpis).map(key => [key, av.kpis[key] !== null && bv.kpis[key] !== null ? bv.kpis[key]! - av.kpis[key]! : null])) }; });
}
export function runScenarios(requests: readonly ScenarioRequest[]): SkillResult<readonly ScenarioResult[]> {
  return attempt(() => { if (!Array.isArray(requests) || requests.length < 2) throw new FinancialInputError('REQUIRED_FIELD', 'scenarios', 'En az iki senaryo gerekli.');
    if (new Set(requests.map(request => request.name)).size !== requests.length) throw new FinancialInputError('DUPLICATE_SCENARIO', 'scenarios', 'Senaryo isimleri benzersiz olmalı.');
    for (const request of requests.slice(1)) unwrap(compareAlternatives(requests[0], request));
    return requests.map(request => unwrap(evaluateScenario(request))); });
}
export function runSensitivity(base: ScenarioRequest, path: string, values: readonly number[]): SkillResult<readonly ScenarioResult[]> {
  return attempt(() => { if (!Array.isArray(values) || values.length < 2 || values.length > 1000) throw new FinancialInputError('INVALID_RANGE', 'values', 'Duyarlılık için 2–1000 değer gerekli.');
    return values.map((value, i) => unwrap(evaluateScenario(unwrap(applyScenarioPatches(base, [{ path, value }], `Duyarlılık ${i + 1}`))))); });
}
export type StressShock = Readonly<{ path: string; mode: 'relative' | 'percentage-points' | 'absolute'; change: number }>;
export function runStressTest(base: ScenarioRequest, shocks: readonly StressShock[]): SkillResult<ReturnType<typeof runWhatIf> extends SkillResult<infer T> ? T : never> {
  return attempt(() => {
    if (!Array.isArray(shocks) || !shocks.length) throw new FinancialInputError('REQUIRED_FIELD', 'shocks', 'En az bir stres değişikliği gerekli.');
    const seen = new Set<string>();
    const patches = shocks.map(shock => {
      if (seen.has(shock.path)) throw new FinancialInputError('DUPLICATE_SHOCK', shock.path, 'Bir alan için tek birleşik stres değişikliği girin.'); seen.add(shock.path);
      let value: unknown = base;
      for (const key of shock.path.split('.')) value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
      const original = finite(value as number, shock.path); finite(shock.change, shock.path);
      if (!['relative', 'percentage-points', 'absolute'].includes(shock.mode)) throw new FinancialInputError('INVALID_SHOCK', shock.path, 'Stres değişiklik türü geçersiz.');
      if (shock.mode === 'percentage-points' && !/(Occupancy|occupancy|Rate|Growth|referenceOccupancy)$/.test(shock.path)) throw new FinancialInputError('INVALID_SHOCK', shock.path, 'Yüzde puanı yalnız oran alanında kullanılabilir.');
      return { path: shock.path, value: shock.mode === 'relative' ? original * (1 + shock.change) : original + (shock.mode === 'percentage-points' ? shock.change / 100 : shock.change) };
    });
    return unwrap(runWhatIf(base, patches));
  });
}
