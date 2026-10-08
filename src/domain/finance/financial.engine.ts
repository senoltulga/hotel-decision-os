import type { OperatingMetrics } from './finance.types.ts';
import { validateOperatingCase, validateFinance } from './finance.schema.ts';
import { isRecord } from '../case/case.schema.ts';
import { compileDemand } from '../skills/demand.skill.ts';
import { attempt, finite, unwrap, calculateOperatingMetrics, calculateCashFlow, calculateDscr } from '../skills/financial.skills.ts';
import { calculateDirectCapitalization, calculateTerminalValue, calculateDcf, calculateIrr, calculatePayback } from '../skills/valuation.skills.ts';
import type { IrrResult } from '../skills/valuation.skills.ts';
import type { SkillResult } from '../skills/skill.types.ts';
import { validateCandidate } from '../constraints/constraint.validator.ts';
import type { ConstraintResult } from '../constraints/constraint.validator.ts';

export type OperatingResult = Readonly<{ metrics: OperatingMetrics; constraints: ConstraintResult }>;
export type InvestmentResult = OperatingResult & Readonly<{
  annual: readonly Readonly<{ year: number; operating: OperatingMetrics; tax: number; capex: number; workingCapital: number; debtService: number; cashFlow: number; dscr: number | null }>[];
  terminalValue: number; forecastPv: number; terminalPv: number; dcfValue: number; npv: number;
  directCapitalizationValue: number | null; irr: IrrResult;
  payback: Readonly<{ years: number | null; recovered: boolean }>; discountedPayback: Readonly<{ years: number | null; recovered: boolean }>;
  usedAssumptions: unknown; version: 'finance.v1';
}>;
export function evaluateOperatingCase(input: unknown, adr: number): SkillResult<OperatingResult> {
  return attempt(() => {
    const data = unwrap(validateOperatingCase(input));
    const model = unwrap(compileDemand(data.case)); const q = unwrap(model.occupancyAt(adr));
    const metrics = unwrap(calculateOperatingMetrics(data.capacity, adr, q, data.otherRevenues, data.costs));
    const constraints = validateCandidate(adr, q, { minAdr: model.minAdr, maxAdr: model.maxAdr, minOccupancy: data.case.minOccupancy });
    return { metrics, constraints };
  });
}
export function evaluateInvestmentCase(input: unknown, adr: number): SkillResult<InvestmentResult> {
  return attempt(() => {
    const data = unwrap(validateOperatingCase(input));
    const finance = unwrap(validateFinance(isRecord(input) ? input.finance : undefined));
    const base = unwrap(evaluateOperatingCase(data, adr));
    const annual: InvestmentResult['annual'][number][] = [];
    for (let year = 1; year <= finance.forecastHorizon; year++) {
      const rf = finite((1 + finance.revenueGrowth) ** (year - 1), 'revenueGrowthFactor');
      const cf = finite((1 + finance.costGrowth) ** (year - 1), 'costGrowthFactor');
      const streams = data.otherRevenues.map(stream => ({ ...stream, fixedAnnual: stream.fixedAnnual * rf, perOccupiedRoomNight: stream.perOccupiedRoomNight * rf }));
      const costs = { ...data.costs, fixedOpex: data.costs.fixedOpex * cf, variablePerOccupiedRoomNight: data.costs.variablePerOccupiedRoomNight * cf, propertyExpenses: data.costs.propertyExpenses * cf, nonOperatingIncome: data.costs.nonOperatingIncome * rf };
      const operating = unwrap(calculateOperatingMetrics(data.capacity, adr * rf, base.metrics.occupancy, streams, costs));
      const tax = Math.max(0, operating.noi) * finance.taxRate;
      const capex = finance.annualCapex[year - 1]; const workingCapital = finance.workingCapitalChanges[year - 1]; const debtService = finance.annualDebtService[year - 1];
      const cashFlow = unwrap(calculateCashFlow(operating.noi, tax, capex, workingCapital, debtService, finance.cashFlowMode));
      annual.push({ year, operating, tax, capex, workingCapital, debtService, cashFlow, dscr: unwrap(calculateDscr(operating.noi, debtService)) });
    }
    const last = annual.at(-1)!;
    const terminal = finance.terminal;
    const grossTerminalValue = unwrap(calculateTerminalValue(terminal.method === 'exit-cap' ? { method: 'exit-cap', nextYearNoi: last.operating.noi * (1 + terminal.noiGrowth), exitCapRate: terminal.exitCapRate, sellingCostRate: terminal.sellingCostRate }
      : terminal.method === 'gordon' ? { method: 'gordon', lastCashFlow: last.cashFlow, growth: terminal.growth, discountRate: finance.discountRate } : terminal));
    const terminalValue=finite(grossTerminalValue-(finance.cashFlowMode==='equity'&&['exit-cap','explicit'].includes(terminal.method)?finance.terminalDebtBalance!:0),'terminalValue');
    const annualFlows = annual.map(item => item.cashFlow);
    const flowsWithExit = [...annualFlows]; flowsWithExit[flowsWithExit.length - 1] += terminalValue;
    const dcf = unwrap(calculateDcf(annualFlows, finance.discountRate, terminalValue));
    const direct = calculateDirectCapitalization(base.metrics.noi, finance.capRate);
    return { ...base, annual, terminalValue, forecastPv: dcf.forecastPv, terminalPv: dcf.terminalPv, dcfValue: dcf.value,
      npv: finite(dcf.value - finance.initialInvestment, 'npv'), directCapitalizationValue: direct.success ? direct.value : null,
      irr: unwrap(calculateIrr([-finance.initialInvestment, ...flowsWithExit])),
      // Payback concerns operating recovery; terminal sale proceeds are deliberately excluded.
      payback: unwrap(calculatePayback(finance.initialInvestment, annualFlows)), discountedPayback: unwrap(calculatePayback(finance.initialInvestment, annualFlows, finance.discountRate)),
      usedAssumptions: structuredClone({ ...data, finance }), version: 'finance.v1' };
  });
}
