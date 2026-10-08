import { isRecord } from '../case/case.schema.ts';
import { checkMaxRevparReadiness } from '../readiness/readiness.engine.ts';
import type { ReadinessResult } from '../readiness/readiness.engine.ts';
import type { SkillResult } from '../skills/skill.types.ts';
import { attempt, finite, nonnegative, ratio, unwrap, FinancialInputError, calculateOperatingMetrics } from '../skills/financial.skills.ts';
import { compileDemand } from '../skills/demand.skill.ts';
import type { FinancialCase, FinanceAssumptions } from './finance.types.ts';

export type OperatingCase = Omit<FinancialCase, 'finance'>;
export function validateOperatingCase(input: unknown): SkillResult<OperatingCase> {
  return attempt(() => {
    if (!isRecord(input)) throw new FinancialInputError('INVALID_CASE', '', 'Finansal Case nesnesi gerekli.');
    const readiness = checkMaxRevparReadiness(input.case);
    if (readiness.status !== 'READY' || !readiness.caseSnapshot) {
      const issue = readiness.issues[0] ?? { code: 'REQUIRED_FIELD', path: readiness.missingFields[0]?.path ?? 'case', message: readiness.missingFields[0]?.reason ?? 'Case gerekli.' };
      throw new FinancialInputError(issue.code, `case.${issue.path}`, issue.message);
    }
    for (const key of ['capacity', 'costs', 'otherRevenues']) if (input[key] == null) throw new FinancialInputError('REQUIRED_FIELD', key, `${key} gerekli.`);
    for (const [group, fields] of Object.entries({ capacity: ['roomCount', 'openDays', 'unavailableRoomNights'], costs: ['fixedOpex', 'variablePerOccupiedRoomNight', 'variableRevenueRate', 'managementFeeRate', 'propertyExpenses', 'nonOperatingIncome', 'replacementReserveRate'] })) {
      if (!isRecord(input[group])) throw new FinancialInputError('INVALID_INPUT', group, `${group} nesnesi gerekli.`);
      for (const field of fields) if (input[group][field] == null) throw new FinancialInputError('REQUIRED_FIELD', `${group}.${field}`, `${group}.${field} gerekli; yoksa açıkça 0 girin.`);
    }
    const data = structuredClone({ case: readiness.caseSnapshot, capacity: input.capacity, costs: input.costs, otherRevenues: input.otherRevenues }) as OperatingCase;
    const period=readiness.caseSnapshot.period;
    const days=(Date.parse(`${period.end}T00:00:00Z`)-Date.parse(`${period.start}T00:00:00Z`))/86400000+1;
    if(days<365||days>366)throw new FinancialInputError('ANNUAL_PERIOD_REQUIRED','case.period','Yıllık gelir/gider modeli için Case dönemi 365–366 gün olmalı; kısmi dönem varsayımlarını yıllıklaştırın.');
    const model = unwrap(compileDemand(readiness.caseSnapshot));
    unwrap(calculateOperatingMetrics(data.capacity, model.minAdr, unwrap(model.occupancyAt(model.minAdr)), data.otherRevenues, data.costs));
    return data;
  });
}
export function validateFinance(input: unknown): SkillResult<FinanceAssumptions> {
  return attempt(() => {
    if (input == null) throw new FinancialInputError('REQUIRED_FIELD', 'finance', 'Finans varsayımları gerekli.');
    if (!isRecord(input)) throw new FinancialInputError('INVALID_INPUT', 'finance', 'Finans nesnesi gerekli.');
    for (const key of ['forecastHorizon', 'discountRate', 'capRate', 'revenueGrowth', 'costGrowth', 'taxRate', 'cashFlowMode', 'initialInvestment', 'annualCapex', 'workingCapitalChanges', 'annualDebtService', 'terminal']) if (input[key] == null) throw new FinancialInputError('REQUIRED_FIELD', `finance.${key}`, `${key} gerekli.`);
    const data = structuredClone(input) as FinanceAssumptions;
    if (!Number.isSafeInteger(data.forecastHorizon) || data.forecastHorizon < 1 || data.forecastHorizon > 100) throw new FinancialInputError('INVALID_HORIZON', 'finance.forecastHorizon', 'Tahmin ufku 1–100 yıl olmalı.');
    for (const [key, val] of Object.entries({ discountRate: data.discountRate, revenueGrowth: data.revenueGrowth, costGrowth: data.costGrowth })) if (finite(val, `finance.${key}`) <= -1) throw new FinancialInputError('INVALID_RATE', `finance.${key}`, 'Oran -%100’den büyük olmalı.');
    if (finite(data.capRate, 'finance.capRate') <= 0) throw new FinancialInputError('INVALID_RATE', 'finance.capRate', 'Cap rate pozitif olmalı.');
    ratio(data.taxRate, 'finance.taxRate'); nonnegative(data.initialInvestment, 'finance.initialInvestment');
    if (!['property', 'equity'].includes(data.cashFlowMode)) throw new FinancialInputError('INVALID_MODE', 'finance.cashFlowMode', 'Property veya equity seçin.');
    for (const key of ['annualCapex', 'workingCapitalChanges', 'annualDebtService'] as const) {
      if (!Array.isArray(data[key]) || data[key].length !== data.forecastHorizon) throw new FinancialInputError('INVALID_SCHEDULE', `finance.${key}`, `${key} tahmin ufkuyla aynı sayıda yıllık değer içermeli.`);
      data[key].forEach((value, i) => key === 'workingCapitalChanges' ? finite(value, `${key}.${i}`) : nonnegative(value, `${key}.${i}`));
    }
    if (!isRecord(data.terminal)) throw new FinancialInputError('INVALID_TERMINAL', 'finance.terminal', 'Terminal yöntemi nesnesi gerekli.');
    const terminal = data.terminal;
    if (terminal.method === 'exit-cap') { if (finite(terminal.exitCapRate, 'exitCapRate') <= 0) throw new FinancialInputError('INVALID_RATE', 'exitCapRate', 'Exit cap rate pozitif olmalı.'); if (finite(terminal.noiGrowth, 'noiGrowth') <= -1) throw new FinancialInputError('INVALID_RATE', 'noiGrowth', 'Büyüme -%100’den büyük olmalı.'); ratio(terminal.sellingCostRate, 'sellingCostRate'); }
    else if (terminal.method === 'gordon') { if (finite(terminal.growth, 'terminal.growth') <= -1 || terminal.growth >= data.discountRate) throw new FinancialInputError('INVALID_GORDON', 'terminal.growth', 'Gordon büyümesi -1 ile iskonto oranı arasında olmalı.'); }
    else if (terminal.method === 'explicit') nonnegative(terminal.amount, 'terminal.amount');
    else if (terminal.method !== 'none') throw new FinancialInputError('INVALID_TERMINAL', 'finance.terminal', 'Terminal yöntemi desteklenmiyor.');
    if (data.terminalDebtBalance !== undefined) nonnegative(data.terminalDebtBalance,'finance.terminalDebtBalance');
    if (data.cashFlowMode==='equity'&&['exit-cap','explicit'].includes(terminal.method)&&data.terminalDebtBalance===undefined) throw new FinancialInputError('REQUIRED_FIELD','finance.terminalDebtBalance','Özkaynak satış değerinde dönem sonu kalan borç açıkça girilmeli.');
    return data;
  });
}
export function checkFinancialReadiness(input: unknown, analysis: 'operating' | 'investment' = 'investment'): ReadinessResult {
  const base = isRecord(input) ? checkMaxRevparReadiness(input.case) : checkMaxRevparReadiness(null);
  const missingFields = base.missingFields.map(field => ({ ...field, path: `case.${field.path}` }));
  const issues = base.issues.map(issue => ({ ...issue, path: `case.${issue.path}` }));
  // Enumerate all required inputs, so the UI can ask only for missing fields in one pass.
  const requirements = ['capacity.roomCount','capacity.openDays','capacity.unavailableRoomNights','otherRevenues',
    ...['fixedOpex','variablePerOccupiedRoomNight','variableRevenueRate','managementFeeRate','propertyExpenses','nonOperatingIncome','replacementReserveRate'].map(key=>`costs.${key}`),
    ...(analysis==='investment'?['forecastHorizon','discountRate','capRate','revenueGrowth','costGrowth','taxRate','cashFlowMode','initialInvestment','annualCapex','workingCapitalChanges','annualDebtService','terminal'].map(key=>`finance.${key}`):[])];
  const at=(path:string)=>path.split('.').reduce<unknown>((value,key)=>isRecord(value)?value[key]:undefined,input);
  for(const path of requirements) {
    const value=at(path);
    if(value==null||(typeof value==='string'&&!value.trim())) {
      if(!missingFields.some(field=>field.path===path))missingFields.push({path,reason:`${path} analizi çalıştırmak için gerekli; sıfırsa açıkça 0 girin.`,inputKind:'number'});
    } else if(!['otherRevenues','finance.cashFlowMode','finance.annualCapex','finance.workingCapitalChanges','finance.annualDebtService','finance.terminal'].includes(path)) {
      const signed=['costs.nonOperatingIncome','finance.discountRate','finance.revenueGrowth','finance.costGrowth'].includes(path);
      const rate01=/Rate$/.test(path)&&!['finance.discountRate','finance.capRate'].includes(path);
      const integer=['capacity.roomCount','capacity.openDays','capacity.unavailableRoomNights','finance.forecastHorizon'].includes(path);
      const bad=typeof value!=='number'||!Number.isFinite(value)||(!signed&&value<0)||(rate01&&value>1)||(integer&&!Number.isSafeInteger(value))||(['capacity.roomCount','capacity.openDays','finance.forecastHorizon','finance.capRate'].includes(path)&&value<=0)||(['finance.discountRate','finance.revenueGrowth','finance.costGrowth'].includes(path)&&value<=-1);
      if(bad)issues.push({code:'INVALID_NUMBER',path,message:`${path}: geçerli sonlu sayı ve birim aralığı gerekli.`,remediation:'Sonlu ve geçerli bir değer girin.'});
    }
  }
  const operating = validateOperatingCase(input);
  const finance = analysis === 'investment' ? validateFinance(isRecord(input) ? input.finance : undefined) : undefined;
  for (const validation of [operating, finance]) if (validation && !validation.success) {
    for (const issue of validation.issues) {
      if (issue.code === 'REQUIRED_FIELD') { if (!missingFields.some(field => field.path === issue.path)) missingFields.push({ path: issue.path, reason: issue.message, inputKind: 'number' }); }
      else if (!issues.some(item => item.path === issue.path && item.code === issue.code)) issues.push({ ...issue, remediation: 'İlgili finansal girdiyi düzeltip hazırlığı tekrar kontrol edin.' });
    }
  }
  return { status: issues.length ? 'BLOCKED' : missingFields.length ? 'INCOMPLETE' : 'READY', missingFields, issues, warnings: base.warnings, ...(base.caseSnapshot ? { caseSnapshot: base.caseSnapshot } : {}) };
}
