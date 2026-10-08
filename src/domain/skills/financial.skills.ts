import type { SkillResult } from './skill.types.ts';
import type { Capacity, RevenueStream, OperatingCosts, OperatingMetrics } from '../finance/finance.types.ts';
import type { Issue } from '../case/case.types.ts';

export class FinancialInputError extends Error {
  readonly issue: Issue;
  constructor(code: string, path: string, message: string) { super(message); this.issue = { code, path, message }; }
}
export function finite(value: number, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new FinancialInputError('INVALID_NUMBER', path, `${path}: sonlu sayı gerekli.`);
  return value;
}
export function nonnegative(value: number, path: string): number {
  finite(value, path); if (value < 0) throw new FinancialInputError('INVALID_NUMBER', path, `${path}: negatif olamaz.`); return value;
}
export function ratio(value: number, path: string): number {
  nonnegative(value, path); if (value > 1) throw new FinancialInputError('INVALID_RATIO', path, `${path}: 0–1 oranı gerekli.`); return value;
}
export function attempt<T>(operation: () => T): SkillResult<T> {
  try { return { success: true, value: operation() }; }
  catch (error) { return { success: false, issues: [error instanceof FinancialInputError ? error.issue : { code: 'INVALID_INPUT', path: '', message: error instanceof Error ? error.message : 'Geçersiz finansal girdi.' }] }; }
}
export function unwrap<T>(result: SkillResult<T>): T {
  if (!result.success) { const issue = result.issues[0]; throw new FinancialInputError(issue.code, issue.path, issue.message); }
  return result.value;
}
export const FINANCIAL_SKILL_VERSION = 'finance.v1';

export function calculateAdr(roomRevenue: number, occupiedRoomNights: number): SkillResult<number | null> {
  return attempt(() => { nonnegative(roomRevenue, 'roomRevenue'); nonnegative(occupiedRoomNights, 'occupiedRoomNights');
    if (!occupiedRoomNights) { if (roomRevenue) throw new FinancialInputError('INCONSISTENT_REVENUE', 'roomRevenue', 'Satılan oda gecesi yokken oda geliri olamaz.'); return null; }
    return finite(roomRevenue / occupiedRoomNights, 'adr'); });
}
export function calculateCapacity(capacity: Capacity): SkillResult<number> {
  return attempt(() => {
    if (!Number.isSafeInteger(capacity.roomCount) || capacity.roomCount <= 0) throw new FinancialInputError('INVALID_CAPACITY', 'capacity.roomCount', 'Pozitif tam sayı oda sayısı gerekli.');
    if (!Number.isInteger(capacity.openDays) || capacity.openDays < 1 || capacity.openDays > 366) throw new FinancialInputError('INVALID_CAPACITY', 'capacity.openDays', 'Açık gün sayısı 1–366 arasında tam sayı olmalı.');
    if (capacity.bedCount !== undefined && (!Number.isSafeInteger(capacity.bedCount) || capacity.bedCount < capacity.roomCount)) throw new FinancialInputError('INVALID_CAPACITY', 'capacity.bedCount', 'Yatak sayısı oda sayısından az olmayan tam sayı olmalı.');
    nonnegative(capacity.unavailableRoomNights, 'capacity.unavailableRoomNights');
    if (!Number.isInteger(capacity.unavailableRoomNights)) throw new FinancialInputError('INVALID_CAPACITY', 'capacity.unavailableRoomNights', 'Kullanılamayan oda geceleri tam sayı olmalı.');
    if (capacity.unavailableRoomNights > 0 && !capacity.unavailableReason?.trim()) throw new FinancialInputError('REQUIRED_FIELD', 'capacity.unavailableReason', 'Kullanılamayan kapasitenin nedeni gerekli.');
    const available = finite(capacity.roomCount * capacity.openDays - capacity.unavailableRoomNights, 'availableRoomNights');
    if (available <= 0) throw new FinancialInputError('INVALID_CAPACITY', 'capacity', 'Kullanılabilir kapasite pozitif olmalı.');
    return available;
  });
}
export function calculateRoomRevenue(availableRoomNights: number, occupancy: number, adr: number): SkillResult<number> {
  return attempt(() => { nonnegative(availableRoomNights, 'availableRoomNights'); ratio(occupancy, 'occupancy'); nonnegative(adr, 'adr'); return finite(availableRoomNights * occupancy * adr, 'roomRevenue'); });
}
export function calculateOtherRevenue(streams: readonly RevenueStream[], occupiedRoomNights: number): SkillResult<number> {
  return attempt(() => { nonnegative(occupiedRoomNights, 'occupiedRoomNights');
    if (!Array.isArray(streams)) throw new FinancialInputError('REQUIRED_FIELD', 'otherRevenues', 'Gelir kalemleri dizisi gerekli; yoksa açıkça boş dizi girin.');
    const names = new Set<string>();
    return finite(streams.reduce((total, stream, i) => {
      if (typeof stream.name !== 'string' || !stream.name.trim() || names.has(stream.name)) throw new FinancialInputError('INVALID_REVENUE_STREAM', `otherRevenues.${i}`, 'Gelir kalemleri benzersiz isim taşımalı.');
      names.add(stream.name); return total + nonnegative(stream.fixedAnnual, `${stream.name}.fixedAnnual`) + nonnegative(stream.perOccupiedRoomNight, `${stream.name}.perOccupiedRoomNight`) * occupiedRoomNights;
    }, 0), 'otherRevenue'); });
}
export function calculateTotalRevenue(roomRevenue: number, otherRevenue: number): SkillResult<number> {
  return attempt(() => finite(nonnegative(roomRevenue, 'roomRevenue') + nonnegative(otherRevenue, 'otherRevenue'), 'totalRevenue'));
}
export function calculateOpex(totalRevenue: number, occupiedRoomNights: number, costs: OperatingCosts): SkillResult<number> {
  return attempt(() => finite(nonnegative(costs.fixedOpex, 'costs.fixedOpex') + nonnegative(costs.variablePerOccupiedRoomNight, 'costs.variablePerOccupiedRoomNight') * nonnegative(occupiedRoomNights, 'occupiedRoomNights') + ratio(costs.variableRevenueRate, 'costs.variableRevenueRate') * nonnegative(totalRevenue, 'totalRevenue'), 'opex'));
}
export function calculateGop(totalRevenue: number, opex: number): SkillResult<number> {
  return attempt(() => finite(nonnegative(totalRevenue, 'totalRevenue') - nonnegative(opex, 'opex'), 'gop'));
}
export function calculateEbitda(gop: number, managementFee: number, propertyExpenses: number, nonOperatingIncome: number): SkillResult<number> {
  return attempt(() => finite(finite(gop, 'gop') - nonnegative(managementFee, 'managementFee') - nonnegative(propertyExpenses, 'propertyExpenses') + finite(nonOperatingIncome, 'nonOperatingIncome'), 'ebitda'));
}
export function calculateNoi(ebitda: number, replacementReserve: number): SkillResult<number> {
  return attempt(() => finite(finite(ebitda, 'ebitda') - nonnegative(replacementReserve, 'replacementReserve'), 'noi'));
}
export function calculateOperatingMetrics(capacity: Capacity, adr: number, occupancy: number, streams: readonly RevenueStream[], costs: OperatingCosts): SkillResult<OperatingMetrics> {
  return attempt(() => {
    const availableRoomNights = unwrap(calculateCapacity(capacity));
    ratio(occupancy, 'occupancy'); nonnegative(adr, 'adr');
    const occupiedRoomNights = finite(availableRoomNights * occupancy, 'occupiedRoomNights');
    const roomRevenue = unwrap(calculateRoomRevenue(availableRoomNights, occupancy, adr));
    const otherRevenue = unwrap(calculateOtherRevenue(streams, occupiedRoomNights));
    const totalRevenue = unwrap(calculateTotalRevenue(roomRevenue, otherRevenue));
    const opex = unwrap(calculateOpex(totalRevenue, occupiedRoomNights, costs));
    const gop = unwrap(calculateGop(totalRevenue, opex));
    const managementFee = finite(totalRevenue * ratio(costs.managementFeeRate, 'costs.managementFeeRate'), 'managementFee');
    const propertyExpenses = nonnegative(costs.propertyExpenses, 'costs.propertyExpenses');
    const ebitda = unwrap(calculateEbitda(gop, managementFee, propertyExpenses, costs.nonOperatingIncome));
    const replacementReserve = finite(totalRevenue * ratio(costs.replacementReserveRate, 'costs.replacementReserveRate'), 'replacementReserve');
    const noi = unwrap(calculateNoi(ebitda, replacementReserve));
    return { adr, occupancy, availableRoomNights, occupiedRoomNights, revpar: finite(adr * occupancy, 'revpar'), roomRevenue, otherRevenue, totalRevenue, opex, gop, managementFee, propertyExpenses, ebitda, replacementReserve, noi };
  });
}
export function calculateCashFlow(noi: number, tax: number, capex: number, workingCapitalChange: number, debtService: number, mode: 'property' | 'equity'): SkillResult<number> {
  return attempt(() => { if (mode !== 'property' && mode !== 'equity') throw new FinancialInputError('INVALID_MODE', 'cashFlowMode', 'Property veya equity seçin.');
    nonnegative(debtService,'debtService');
    return finite(finite(noi, 'noi') - nonnegative(tax, 'tax') - nonnegative(capex, 'capex') - finite(workingCapitalChange, 'workingCapitalChange') - (mode === 'equity' ? nonnegative(debtService, 'debtService') : 0), 'cashFlow'); });
}
export function calculateDscr(noi: number, debtService: number): SkillResult<number | null> {
  return attempt(() => { finite(noi, 'noi'); nonnegative(debtService, 'debtService'); return debtService === 0 ? null : finite(noi / debtService, 'dscr'); });
}
