import { ANALYSIS_TEMPLATES } from '../templates/analysis.templates.ts';
import { checkMaxRevparReadiness } from '../readiness/readiness.engine.ts';
import { checkFinancialReadiness } from '../finance/finance.schema.ts';
import { isRecord } from '../case/case.schema.ts';
import type { AnalysisTemplate } from '../templates/analysis.templates.ts';

/** Deterministic intent guide. No LLM is used for recommendations or calculations. */
export function recommendAnalysis(intent: string): readonly AnalysisTemplate[] {
  const text = intent.toLocaleLowerCase('tr-TR');
  const ids = /risk|denge|trade|birlikte/.test(text) ? ['pareto-npv-risk', 'stress']
    : /yatırım|değer|npv/.test(text) ? ['max-npv', 'scenarios'] : /gider|maliyet|opex/.test(text) ? ['min-opex', 'pareto-noi-opex']
    : /fiyat|doluluk|revpar/.test(text) ? ['max-revpar', 'what-if'] : ['what-if', 'scenarios'];
  return ids.flatMap(id => ANALYSIS_TEMPLATES.filter(template => template.id === id));
}
export function readinessForTemplate(template: AnalysisTemplate, input: unknown) {
  return template.depth === 'pricing' ? checkMaxRevparReadiness(isRecord(input) ? input.case : undefined) : checkFinancialReadiness(input, template.depth);
}
export type WizardState = Readonly<{ phase: 'CASE' | 'TOOL' | 'INPUTS' | 'REVIEW' | 'RESULT'; selectedTool?: string; approved: boolean; revision: number; resultRevision?: number }>;
export function startWizard(): WizardState { return { phase: 'CASE', approved: false, revision: 0 }; }
export function selectWizardTool(state: WizardState, template: AnalysisTemplate): WizardState { return { ...state, phase: 'TOOL', selectedTool: template.id, approved: false }; }
export function approveWizardTool(state: WizardState): WizardState { if (!state.selectedTool) throw new Error('Önce araç seçin.'); return { ...state, phase: 'INPUTS', approved: true }; }
export function invalidateWizard(state: WizardState): WizardState { return { ...state, phase: state.approved ? 'INPUTS' : state.phase, revision: state.revision + 1, resultRevision: undefined }; }
export function reviewWizard(state: WizardState, ready: boolean): WizardState { if (!state.approved || !ready) throw new Error('Onay ve READY verisi gerekli.'); return { ...state, phase: 'REVIEW' }; }
export function completeWizard(state: WizardState): WizardState { if (state.phase !== 'REVIEW') throw new Error('Hesaplamadan önce varsayım özeti gerekli.'); return { ...state, phase: 'RESULT', resultRevision: state.revision }; }
