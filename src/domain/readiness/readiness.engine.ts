import { isRecord, validateCaseForAnalysis } from '../case/case.schema.ts';
import type { Issue, ValidatedCase } from '../case/case.types.ts';
import { compileDemand } from '../skills/demand.skill.ts';
import { NUMERICAL_POLICY } from '../numerics/numerical-policy.ts';

export type MissingField = Readonly<{ path: string; reason: string; inputKind: 'number' | 'ratio' | 'text' | 'date' | 'model' | 'points' }>;
export type ReadinessIssue = Issue & Readonly<{ remediation: string }>;
export type ReadinessResult = Readonly<{
  status: 'READY' | 'INCOMPLETE' | 'BLOCKED';
  missingFields: readonly MissingField[];
  issues: readonly ReadinessIssue[];
  warnings: readonly Readonly<{ code: string; message: string }>[];
  caseSnapshot?: ValidatedCase;
}>;

const reasons: Record<string, string> = {
  name: 'Analizi hangi otele ait olduğunu belirterek saklamak için otel adı gerekli.',
  currency: 'ADR ve RevPAR tutarlarını aynı para biriminde yorumlamak için gerekli.',
  'period.start': 'Talep varsayımının başlangıç dönemini belirtmek için gerekli.',
  'period.end': 'Talep varsayımının bitiş dönemini belirtmek için gerekli.',
  minAdr: 'Hesaplamada izin verilen en düşük fiyatı belirlemek için gerekli.',
  maxAdr: 'Hesaplamada izin verilen en yüksek fiyatı belirlemek için gerekli.',
  demand: 'Fiyat değiştiğinde doluluğun nasıl değişeceğini belirlemek için talep modeli gerekli.',
  'demand.kind': 'Hangi talep modelinin kullanılacağını seçin.',
  referenceAdr: 'Doğrusal talebi bağlamak veya baz karşılaştırması yapmak için referans fiyat gerekli.',
  referenceOccupancy: 'Referans fiyattaki doluluk oranını bilmek için gerekli.',
  'demand.adrIncrease': 'Doluluk düşüşünün hangi fiyat artışı için geçerli olduğunu belirtmek için gerekli.',
  'demand.occupancyDecreasePp': 'Fiyat artışına karşı doluluk düşüşünü yüzde puanı olarak tanımlamak için gerekli.',
  'demand.validMinAdr': 'Talep varsayımının geçerli olduğu en düşük fiyatı belirtmek için gerekli.',
  'demand.validMaxAdr': 'Talep varsayımının geçerli olduğu en yüksek fiyatı belirtmek için gerekli.',
  'demand.points': 'Fiyat–doluluk ilişkisini en az iki noktadan kurmak için gerekli.',
};
function at(input: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => isRecord(value) ? value[key] : undefined, input);
}
function missing(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}
function inputKind(path: string): MissingField['inputKind'] {
  if (path === 'demand' || path === 'demand.kind') return 'model';
  if (path === 'demand.points') return 'points';
  if (path.startsWith('period.')) return 'date';
  if (path.includes('Occupancy')) return 'ratio';
  if (['name', 'currency', 'id', 'demand.modelVersion'].includes(path)) return 'text';
  return 'number';
}

export function checkMaxRevparReadiness(input: unknown): ReadinessResult {
  const parsed = validateCaseForAnalysis(input);
  const missingFields: MissingField[] = [];
  const issues: ReadinessIssue[] = [];
  const warnings: { code: string; message: string }[] = [];
  const appendMissing = (path: string) => {
    if (!missingFields.some(field => field.path === path)) missingFields.push({ path, reason: reasons[path] ?? 'Analiz sözleşmesini tamamlamak için bu alan gerekli.', inputKind: inputKind(path) });
  };
  if (!parsed.success) {
    for (const issue of parsed.issues) {
      if (issue.path && missing(at(input, issue.path)) && (issue.code === 'REQUIRED_FIELD' || reasons[issue.path])) {
        if (issue.path === 'period') { appendMissing('period.start'); appendMissing('period.end'); }
        else appendMissing(issue.path);
      } else issues.push({ ...issue, remediation: `“${issue.path || 'Case'}” alanını düzeltip hazırlık kontrolünü tekrar çalıştırın.` });
    }
    // A missing entire period is expanded into its actual input fields.
    if (missingFields.some(field => field.path === 'period')) {
      missingFields.splice(missingFields.findIndex(field => field.path === 'period'), 1);
      appendMissing('period.start'); appendMissing('period.end');
    }
    return { status: issues.length ? 'BLOCKED' : 'INCOMPLETE', missingFields, issues, warnings };
  }
  const compiled = compileDemand(parsed.data);
  if (!compiled.success) return {
    status: 'BLOCKED', missingFields, issues: compiled.issues.map(issue => ({ ...issue, remediation: 'Talep parametrelerini veya analiz fiyat aralığını düzeltin; doluluk 0–1 içinde kalmalı.' })), warnings,
  };
  if(parsed.data.assumptionNotes?.trim())warnings.push({code:'ASSUMPTION_NOTES',message:parsed.data.assumptionNotes});
  const highestOccupancy = Math.max(...compiled.value.segments.map(segment => segment.occupancyAtMin));
  if (parsed.data.minOccupancy !== undefined && parsed.data.minOccupancy - highestOccupancy > NUMERICAL_POLICY.ratioTolerance) {
    warnings.push({ code: 'NO_FEASIBLE_OCCUPANCY', message: 'Veri hazır, ancak bu talep modeliyle fiyat aralığındaki hiçbir fiyat minimum doluluk şartını karşılamıyor.' });
  }
  if (parsed.data.demand.kind === 'scenario-points' && parsed.data.referenceAdr !== undefined && parsed.data.referenceOccupancy !== undefined) {
    const prediction = compiled.value.occupancyAt(parsed.data.referenceAdr);
    if (!prediction.success) warnings.push({ code: 'REFERENCE_OUTSIDE_ANALYSIS_RANGE', message: 'Referans fiyat analiz aralığı dışında; baz ölçümü model kalibrasyonu sayılmaz.' });
    else if (Math.abs(prediction.value - parsed.data.referenceOccupancy) > NUMERICAL_POLICY.ratioTolerance) warnings.push({ code: 'REFERENCE_MODEL_MISMATCH', message: 'Baz doluluk ölçümü talep modelinden farklı; baz ölçümü ve model varsayımı ayrı değerlendirilmelidir.' });
  }
  return { status: 'READY', missingFields, issues, warnings, caseSnapshot: parsed.data };
}
