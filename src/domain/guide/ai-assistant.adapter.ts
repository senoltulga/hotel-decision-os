import { isRecord } from '../case/case.schema.ts';
import { findAnalysisTemplate } from '../templates/analysis.templates.ts';
import type { AnalysisId } from '../templates/analysis.templates.ts';
import { attempt, FinancialInputError } from '../skills/financial.skills.ts';
import type { SkillResult } from '../skills/skill.types.ts';

export type AssistantProposal = Readonly<{ suggestedTool: AnalysisId; explanation: string; questions: readonly string[]; needsUserApproval: true }>;
export type AssistantProvider = (request: Readonly<{ intent: string; missingFields: readonly string[]; permittedTools: readonly string[]; instruction: string }>) => Promise<unknown>;
/** Optional provider-neutral LLM boundary. Suggestions never mutate Case or call a solver. */
export async function requestAssistantProposal(provider: AssistantProvider, intent: string, missingFields: readonly string[], permittedTools: readonly string[]): Promise<SkillResult<AssistantProposal>> {
  try {
    const response = await provider({ intent, missingFields, permittedTools, instruction: 'Yalnız araç seçimi ve açıklama öner. Finansal hesap, piyasa verisi, sayısal varsayım veya girdi değişikliği üretme.' });
    return attempt(() => {
      if (!isRecord(response) || typeof response.suggestedTool !== 'string' || !permittedTools.includes(response.suggestedTool) || !findAnalysisTemplate(response.suggestedTool)) throw new FinancialInputError('INVALID_ASSISTANT_PROPOSAL', 'suggestedTool', 'Öneri izin verilen analiz araçlarından biri olmalı.');
      if (typeof response.explanation !== 'string' || !response.explanation.trim() || response.explanation.length > 4000 || !Array.isArray(response.questions) || response.questions.some(question => typeof question !== 'string' || question.length > 1000) || response.questions.length > 20) throw new FinancialInputError('INVALID_ASSISTANT_PROPOSAL', '', 'Kısa açıklama ve doğrulanmış soru listesi gerekli.');
      const allowed = new Set(['suggestedTool','explanation','questions']);
      if (Object.keys(response).some(key=>!allowed.has(key))) throw new FinancialInputError('INVALID_ASSISTANT_PROPOSAL', '', 'Hesaplama veya sayısal girdi önerisi kabul edilmez.');
      return Object.freeze({ suggestedTool: response.suggestedTool as AnalysisId, explanation: response.explanation, questions: Object.freeze([...response.questions] as string[]), needsUserApproval: true as const });
    });
  } catch { return { success:false, issues:[{code:'ASSISTANT_UNAVAILABLE',path:'assistant',message:'Açıklama sağlayıcısı yanıt vermedi; deterministik analiz akışı kullanılabilir.'}] }; }
}
