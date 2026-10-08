import type { HotelCaseDraft, ValidatedCase, ValidationResult, Issue } from './case.types.ts';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const absent = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Input must already be normalized. Numeric strings are deliberately rejected here.
export function validateCase(input: unknown, mode: 'draft' | 'analysis' = 'draft'): ValidationResult<HotelCaseDraft | ValidatedCase> {
  const issues: Issue[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (!isRecord(input)) return { success: false, issues: [{ code: 'INVALID_CASE', path: '', message: 'Case bir nesne olmalı.' }] };
  let data: Record<string, unknown>;
  try { data = structuredClone(input); }
  catch { return { success: false, issues: [{ code: 'INVALID_CASE', path: '', message: 'Case yalnızca kopyalanabilir veri içermeli.' }] }; }
  // Normalize only missing values; do not coerce external numeric data.
  for (const key of Object.keys(data)) if (absent(data[key])) delete data[key];
  if (data.schemaVersion !== 'case.v1') add('UNSUPPORTED_SCHEMA', 'schemaVersion', 'case.v1 gerekli.');
  if (typeof data.id !== 'string' || !data.id.trim()) add('REQUIRED_FIELD', 'id', 'Case kimliği gerekli.');
  if (!Number.isSafeInteger(data.revision) || (data.revision as number) < 0) add('INVALID_REVISION', 'revision', 'Revizyon negatif olmayan güvenli tam sayı olmalı.');
  const required = (key: string) => { if (mode === 'analysis' && absent(data[key])) add('REQUIRED_FIELD', key, 'Analiz için bu alan gerekli.'); };
  for (const key of ['name', 'currency', 'period', 'minAdr', 'maxAdr', 'demand']) required(key);
  if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim())) add('INVALID_NAME', 'name', 'Case adı metin olmalı.');
  if (data.currency !== undefined && (typeof data.currency !== 'string' || !Intl.supportedValuesOf('currency').includes(data.currency))) add('INVALID_CURRENCY', 'currency', 'Desteklenen açık para birimi kodu gerekli.');
  for (const key of ['referenceAdr', 'minAdr', 'maxAdr']) {
    if (data[key] !== undefined && (!finite(data[key]) || data[key] <= 0)) add('INVALID_NUMBER', key, 'ADR sonlu ve sıfırdan büyük olmalı.');
  }
  for (const key of ['referenceOccupancy', 'minOccupancy']) {
    if (data[key] !== undefined && (!finite(data[key]) || data[key] < 0 || data[key] > 1)) add('INVALID_OCCUPANCY', key, 'Doluluk 0–1 arasında olmalı.');
  }
  if (finite(data.minAdr) && finite(data.maxAdr) && data.minAdr > data.maxAdr) add('INVALID_ADR_RANGE', 'minAdr', 'Minimum ADR maksimum ADR’yi aşamaz.');
  if (data.assumptionNotes !== undefined && typeof data.assumptionNotes !== 'string') add('INVALID_TEXT', 'assumptionNotes', 'Varsayım açıklaması metin olmalı.');
  if (data.period !== undefined) {
    if (!isRecord(data.period)) add('INVALID_PERIOD', 'period', 'Dönem nesnesi gerekli.');
    else {
      for (const key of ['start', 'end']) {
        if (absent(data.period[key])) {
          delete data.period[key];
          if (mode === 'analysis') add('REQUIRED_FIELD', `period.${key}`, 'Dönem tarihi gerekli.');
        } else if (!validDate(data.period[key])) add('INVALID_PERIOD', `period.${key}`, 'Geçerli YYYY-MM-DD tarihi gerekli.');
      }
      if (validDate(data.period.start) && validDate(data.period.end) && data.period.start > data.period.end) add('INVALID_PERIOD', 'period', 'Başlangıç bitişten sonra olamaz.');
    }
  }
  if (data.demand !== undefined) {
    const demand = data.demand;
    if (!isRecord(demand)) add('INVALID_DEMAND', 'demand', 'Talep modeli nesne olmalı.');
    else {
      if (demand.modelVersion !== 'demand.v1') add('UNSUPPORTED_MODEL_VERSION', 'demand.modelVersion', 'demand.v1 gerekli.');
      if (demand.kind === 'linear-sensitivity') {
        for (const key of ['adrIncrease', 'validMinAdr', 'validMaxAdr']) {
          if (!finite(demand[key]) || demand[key] <= 0) add('INVALID_NUMBER', `demand.${key}`, 'Sonlu pozitif sayı gerekli.');
        }
        if (!finite(demand.occupancyDecreasePp) || demand.occupancyDecreasePp < 0) add('INVALID_NUMBER', 'demand.occupancyDecreasePp', 'Negatif olmayan sonlu yüzde puanı gerekli.');
        if (finite(demand.validMinAdr) && finite(demand.validMaxAdr)) {
          if (demand.validMinAdr > demand.validMaxAdr) add('INVALID_ADR_RANGE', 'demand', 'Model fiyat aralığı geçersiz.');
          if (finite(data.referenceAdr) && (data.referenceAdr < demand.validMinAdr || data.referenceAdr > demand.validMaxAdr)) add('OUTSIDE_DEMAND_DOMAIN', 'referenceAdr', 'Referans ADR model aralığında olmalı.');
          if ((finite(data.minAdr) && data.minAdr < demand.validMinAdr) || (finite(data.maxAdr) && data.maxAdr > demand.validMaxAdr)) add('OUTSIDE_DEMAND_DOMAIN', 'demand', 'Optimizasyon aralığı model alanını aşamaz.');
        }
        if (mode === 'analysis') for (const key of ['referenceAdr', 'referenceOccupancy']) required(key);
      } else if (demand.kind === 'scenario-points') {
        if (!Array.isArray(demand.points) || demand.points.length < 2) add('INVALID_POINTS', 'demand.points', 'En az iki farklı fiyat noktası gerekli.');
        else {
          let pointsValid = true;
          demand.points.forEach((point: unknown, index: number) => {
            if (!isRecord(point) || !finite(point.adr) || point.adr <= 0 || !finite(point.occupancy) || point.occupancy < 0 || point.occupancy > 1) {
              pointsValid = false; add('INVALID_POINT', `demand.points.${index}`, 'Pozitif ADR ve 0–1 doluluk gerekli.');
            }
          });
          if (pointsValid) {
            const points = (demand.points as { adr: number; occupancy: number }[]).sort((a, b) => a.adr - b.adr);
            for (let i = 1; i < points.length; i++) {
              if (points[i].adr === points[i - 1].adr) add('DUPLICATE_ADR_POINT', 'demand.points', 'Tekrarlanan ADR noktası var.');
              if (points[i].occupancy > points[i - 1].occupancy) add('NON_MONOTONE_DEMAND', 'demand.points', 'Doluluk fiyatla artamaz.');
            }
            if ((finite(data.minAdr) && data.minAdr < points[0].adr) || (finite(data.maxAdr) && data.maxAdr > points.at(-1)!.adr)) add('OUTSIDE_DEMAND_DOMAIN', 'demand.points', 'Optimizasyon aralığı noktaların alanını aşamaz.');
          }
        }
        if (mode === 'analysis' && (data.referenceAdr !== undefined || data.referenceOccupancy !== undefined)) for (const key of ['referenceAdr', 'referenceOccupancy']) required(key);
      } else add('UNSUPPORTED_DEMAND_MODEL', 'demand.kind', 'Desteklenmeyen talep modeli.');
    }
  }
  return issues.length ? { success: false, issues } : { success: true, data: data as HotelCaseDraft | ValidatedCase, issues: [] };
}

export function validateCaseForAnalysis(input: unknown): ValidationResult<ValidatedCase> {
  return validateCase(input, 'analysis') as ValidationResult<ValidatedCase>;
}
