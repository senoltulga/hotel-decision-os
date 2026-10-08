import type { AnalysisTemplate } from '../../domain/templates/analysis.templates.ts';
import type { FinancialCase } from '../../domain/finance/finance.types.ts';
import type { ScenarioRequest, ScenarioResult } from '../../domain/simulation/scenario.engine.ts';
import { evaluateScenario, compareAlternatives, runScenarios, runSensitivity, runStressTest, applyScenarioPatches, runWhatIf } from '../../domain/simulation/scenario.engine.ts';
import type { DecisionOption, MetricConstraint } from '../../domain/optimization/optimization.engine.ts';
import { optimizeOptions, paretoOptimize } from '../../domain/optimization/optimization.engine.ts';
import { buildMaxRevparProblem } from '../../domain/problems/max-revpar.builder.ts';
import { solveMaxRevpar } from '../../domain/solvers/max-revpar.solver.ts';
import { explainRevparResult } from '../../domain/results/result.explainer.ts';
import { attempt, unwrap, FinancialInputError } from '../../domain/skills/financial.skills.ts';
import { readinessForTemplate } from '../../domain/guide/decision.guide.ts';
import type { SkillResult } from '../../domain/skills/skill.types.ts';

export type AnalysisControls = Readonly<{
  adr: number; alternativeAdr?: number; options?: readonly DecisionOption[]; constraints?: readonly MetricConstraint[];
  scenarios?: readonly ScenarioRequest[]; sensitivity?: Readonly<{ path: string; values: readonly number[] }>;
  stress?: Readonly<{ adrChange: number; occupancyDropPp: number; opexChange: number; discountIncreasePp: number }>;
}>;
export type AnalysisOutput = Readonly<{ title: string; rows: readonly Readonly<Record<string, string | number | null>>[]; messages: readonly string[]; raw: unknown }>;
const row = (result: ScenarioResult) => ({ name: result.name, ...result.kpis, feasible: result.feasible ? 'Uygun' : 'Kısıtı karşılamıyor' });
export function runAnalysis(template: AnalysisTemplate, input: FinancialCase, controls: AnalysisControls): SkillResult<AnalysisOutput> {
  return attempt(() => {
    const ready = readinessForTemplate(template, input);
    if (ready.status !== 'READY') throw new FinancialInputError('NOT_READY', '', [...ready.missingFields.map(field => field.reason), ...ready.issues.map(issue => issue.message)].join(' '));
    if (template.id === 'max-revpar') {
      const built = buildMaxRevparProblem(input.case);
      if (!built.success) throw new FinancialInputError('NOT_READY', '', built.issues.map(issue => issue.message).join(' '));
      const solution = solveMaxRevpar(built.problem); const explanation = explainRevparResult(solution);
      return { title: explanation.title, rows: solution.status === 'OPTIMAL' ? [{ name: 'Optimum', adr: solution.optimalAdr, occupancy: solution.expectedOccupancy, revpar: solution.maximumRevpar }] : [], messages: explanation.messages, raw: { solution, explanation } };
    }
    const base: ScenarioRequest = { name: 'Baz', financialCase: input, adr: controls.adr, depth: template.depth === 'investment' ? 'investment' : 'operating' };
    if (template.id === 'what-if') {
      const output = unwrap(runWhatIf(base, [{ path: 'adr', value: controls.alternativeAdr! }]));
      return { title: 'What-if karşılaştırması', rows: [row(output.base), row(output.alternative)], messages: ['Alternatif fiyat aynı talep modelinde hesaplandı; optimum önerisi değildir.'], raw: output };
    }
    if (template.id === 'ab') { const output = unwrap(compareAlternatives(base, { ...base, name: 'B', adr: controls.alternativeAdr! })); return { title: 'A/B karşılaştırması', rows: output.alternatives.map(row), messages: ['Aynı dönem, para birimi ve varsayımlarla iki fiyat karşılaştırıldı.'], raw: output }; }
    if (template.id === 'scenarios') {
      const scenarios = controls.scenarios; if (!scenarios) throw new FinancialInputError('REQUIRED_FIELD', 'scenarios', 'Senaryo paketleri gerekli.');
      const output = unwrap(runScenarios(scenarios)); return { title: 'Senaryo sonuçları', rows: output.map(row), messages: ['Senaryo paketlerinin olasılığı tahmin edilmedi.'], raw: output };
    }
    if (template.id === 'sensitivity') {
      if (!controls.sensitivity) throw new FinancialInputError('REQUIRED_FIELD', 'sensitivity', 'Duyarlılık alanı ve değerleri gerekli.');
      const sensitivity=controls.sensitivity;
      const output = unwrap(runSensitivity(base, sensitivity.path, sensitivity.values)); return { title: 'Duyarlılık sonuçları', rows: output.map((scenario,i)=>({...row(scenario),parameter:/Rate$/.test(sensitivity.path)?`%${sensitivity.values[i]*100}`:sensitivity.values[i]})), messages: ['Tek değişken değişti; diğer varsayımlar sabit tutuldu.'], raw: output };
    }
    if (template.id === 'stress') {
      const shock = controls.stress; if (!shock) throw new FinancialInputError('REQUIRED_FIELD', 'stress', 'Stres değişiklikleri gerekli.');
      const output = unwrap(runStressTest(base, [
        { path: 'adr', mode: 'relative', change: shock.adrChange },
        ...(input.case.demand?.kind === 'scenario-points' ? input.case.demand.points.map((_, index) => ({ path: `financialCase.case.demand.points.${index}.occupancy`, mode: 'percentage-points' as const, change: -shock.occupancyDropPp })) : [{ path: 'financialCase.case.referenceOccupancy', mode: 'percentage-points' as const, change: -shock.occupancyDropPp }]),
        { path: 'financialCase.costs.fixedOpex', mode: 'relative', change: shock.opexChange },
        { path: 'financialCase.finance.discountRate', mode: 'percentage-points', change: shock.discountIncreasePp },
      ])); return { title: 'Stres testi', rows: [row(output.base), row(output.alternative)], messages: ['Talep eğrisi referans doluluk düşüşü kadar aşağı kaydırıldı; doluluk azalışı yüzde puanıdır.'], raw: output };
    }
    if (!controls.options) throw new FinancialInputError('REQUIRED_FIELD', 'options', 'Açık karar alternatifleri gerekli.');
    if (template.family === 'multi-objective') {
      const output = unwrap(paretoOptimize(base, controls.options, template.objectives, controls.constraints));
      return { title: 'Pareto seçenekleri', rows: output.front.map(option => ({ ...row(option.scenario), risk: option.metrics.risk, capex: option.metrics.capex, serviceQuality: option.metrics.serviceQuality })),
        messages: [`${output.front.length} baskın olmayan, ${output.dominated.length} baskın ve ${output.infeasible.length} uygun olmayan alternatif.`, 'Tek bir kazanan seçilmedi; sonuç verilen seçenek kümesi için geçerlidir.'], raw: output };
    }
    const output = unwrap(optimizeOptions(base, controls.options, template.objectives[0], controls.constraints));
    return { title: output.status === 'INFEASIBLE' ? 'Uygulanabilir alternatif yok' : 'Karar seçenekleri arasında en iyi sonuç',
      rows: output.best ? [{ ...row(output.best.scenario), risk: output.best.metrics.risk, serviceQuality: output.best.metrics.serviceQuality, capex: output.best.metrics.capex }] : [],
      messages: [`${output.alternatives.length} açık alternatif değerlendirildi.`, 'Bu sonuç yalnız tanımlanan karar alternatifleri için geçerlidir; sürekli karar uzayı optimumu değildir.'], raw: output };
  });
}
