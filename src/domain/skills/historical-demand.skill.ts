import type { SkillResult } from './skill.types.ts';
import { attempt, finite, ratio, FinancialInputError } from './financial.skills.ts';
/** Deterministic OLS fit; association is not price causality. Filter one comparable season/channel/segment first. */
export function fitHistoricalDemand(rows: readonly { adr: number; occupancy: number; season: string; channel: string; segment: string }[]): SkillResult<{
  referenceAdr: number; referenceOccupancy: number; demand: { kind: 'linear-sensitivity'; modelVersion: 'demand.v1'; adrIncrease: number; occupancyDecreasePp: number; validMinAdr: number; validMaxAdr: number };
  rSquared: number; observations: number; warning: string;
}> {
  return attempt(() => {
    if (!Array.isArray(rows) || rows.length < 3) throw new FinancialInputError('INSUFFICIENT_HISTORY', 'rows', 'En az üç karşılaştırılabilir tarihsel gözlem gerekli.');
    rows.forEach((row, i) => { if (finite(row.adr, `rows.${i}.adr`) <= 0) throw new FinancialInputError('INVALID_NUMBER', 'adr', 'Pozitif ADR gerekli.'); ratio(row.occupancy, `rows.${i}.occupancy`); for(const key of ['season','channel','segment'] as const)if(typeof row[key]!=='string'||!row[key].trim())throw new FinancialInputError('REQUIRED_FIELD',`rows.${i}.${key}`,'Sezon, kanal ve segment bilgisi gerekli.'); });
    if (new Set(rows.map(row => JSON.stringify([row.season, row.channel, row.segment]))).size !== 1) throw new FinancialInputError('INCOMPARABLE_HISTORY', 'rows', 'Tek bir sezon, kanal ve segment seçerek karşılaştırılabilir gözlemleri kullanın.');
    const p = rows.reduce((sum, row) => sum + row.adr, 0) / rows.length; const q = rows.reduce((sum, row) => sum + row.occupancy, 0) / rows.length;
    const xx = rows.reduce((sum, row) => sum + (row.adr - p) ** 2, 0); const xy = rows.reduce((sum, row) => sum + (row.adr - p) * (row.occupancy - q), 0);
    if (!xx) throw new FinancialInputError('NO_PRICE_VARIATION', 'rows', 'Talep ilişkisi için farklı fiyatlar gerekli.');
    const slope = finite(xy / xx, 'slope'); if (slope > 0) throw new FinancialInputError('NON_MONOTONE_DEMAND', 'rows', 'Artan tarihsel ilişki fiyat etkisi modeli olarak kabul edilmez.');
    const yy = rows.reduce((sum, row) => sum + (row.occupancy - q) ** 2, 0);
    return { referenceAdr: p, referenceOccupancy: q, demand: { kind: 'linear-sensitivity', modelVersion: 'demand.v1', adrIncrease: 1, occupancyDecreasePp: -slope * 100, validMinAdr: Math.min(...rows.map(row => row.adr)), validMaxAdr: Math.max(...rows.map(row => row.adr)) },
      rSquared: yy === 0 ? 1 : finite(xy * xy / (xx * yy), 'rSquared'), observations: rows.length,
      warning: 'Bu tarihsel uyum nedensel fiyat esnekliği değildir; zaman, talep ve diğer etkenlerden etkilenebilir. Analizden önce model varsayımı olarak gözden geçirin.' };
  });
}
