import { validateCase } from './case.schema.ts';
import { isRecord } from './case.schema.ts';
import { attempt, FinancialInputError } from '../skills/financial.skills.ts';
import type { SkillResult } from '../skills/skill.types.ts';
export type CaseDocument = Readonly<{ version: 'case-document.v1'; payload: unknown }>;
function assertCase(input: unknown) { const result = validateCase(input); if (!result.success) { const issue = result.issues[0]; throw new FinancialInputError(issue.code, issue.path, issue.message); } }
export function serializeCaseDocument(payload: unknown): SkillResult<string> {
  return attempt(() => { if (!isRecord(payload)) throw new FinancialInputError('INVALID_CASE', '', 'Case nesnesi gerekli.'); assertCase(payload.case);
    return JSON.stringify({ version: 'case-document.v1', payload }); });
}
export function parseCaseDocument(text: string): SkillResult<CaseDocument> {
  return attempt(() => { if (typeof text !== 'string' || text.length > 1000000) throw new FinancialInputError('INVALID_DOCUMENT', '', 'Case dosyası 1 MB altında metin olmalı.');
    const data: unknown = JSON.parse(text);
    if (!isRecord(data) || data.version !== 'case-document.v1' || !isRecord(data.payload)) throw new FinancialInputError('INVALID_DOCUMENT', '', 'case-document.v1 nesnesi gerekli.');
    assertCase(data.payload.case);
    // Financial assumptions are deliberately revalidated by per-tool readiness on every run.
    return { version: 'case-document.v1', payload: structuredClone(data.payload) }; });
}
