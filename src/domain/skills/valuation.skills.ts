import { attempt, finite, nonnegative, ratio, FinancialInputError } from './financial.skills.ts';
import type { SkillResult } from './skill.types.ts';
import { nearlyEqual } from '../numerics/numerical-policy.ts';

const validRate = (rate: number) => { finite(rate, 'discountRate'); if (rate <= -1) throw new FinancialInputError('INVALID_RATE', 'discountRate', 'İskonto oranı -%100’den büyük olmalı.'); };
export function calculatePresentValue(cashFlow: number, rate: number, period: number): SkillResult<number> {
  return attempt(() => { finite(cashFlow, 'cashFlow'); validRate(rate); if (!Number.isSafeInteger(period) || period < 0) throw new FinancialInputError('INVALID_PERIOD', 'period', 'Negatif olmayan tam sayı dönem gerekli.');
    return finite(cashFlow / (1 + rate) ** period, 'presentValue'); });
}
/** flows[0] occurs at t=0; subsequent flows at the end of each equal period. */
export function calculateNpv(flows: readonly number[], rate: number): SkillResult<number> {
  return attempt(() => { validRate(rate); if (!Array.isArray(flows) || !flows.length) throw new FinancialInputError('REQUIRED_FIELD', 'cashFlows', 'En az t=0 nakit akışı gerekli.');
    return finite(flows.reduce((sum, flow, t) => sum + finite(flow, `cashFlows.${t}`) / (1 + rate) ** t, 0), 'npv'); });
}
export function calculateDirectCapitalization(noi: number, capRate: number): SkillResult<number> {
  return attempt(() => { finite(noi, 'noi'); finite(capRate, 'capRate'); if (capRate <= 0) throw new FinancialInputError('INVALID_RATE', 'capRate', 'Cap rate pozitif olmalı.');
    if (noi <= 0) throw new FinancialInputError('NON_POSITIVE_NOI', 'noi', 'Doğrudan kapitalizasyon için pozitif stabilize NOI gerekli.'); return finite(noi / capRate, 'propertyValue'); });
}
export function calculateTerminalValue(input: { method: 'none' } | { method: 'explicit'; amount: number } | { method: 'exit-cap'; nextYearNoi: number; exitCapRate: number; sellingCostRate: number } | { method: 'gordon'; lastCashFlow: number; growth: number; discountRate: number }): SkillResult<number> {
  return attempt(() => {
    if (input.method === 'none') return 0;
    if (input.method === 'explicit') return nonnegative(input.amount, 'terminal.amount');
    if (input.method === 'exit-cap') {
      finite(input.exitCapRate, 'exitCapRate'); if (input.exitCapRate <= 0) throw new FinancialInputError('INVALID_RATE', 'exitCapRate', 'Exit cap rate pozitif olmalı.');
      const noi = finite(input.nextYearNoi, 'nextYearNoi'); if (noi <= 0) throw new FinancialInputError('NON_POSITIVE_NOI', 'terminal.nextYearNoi', 'Exit-cap terminal değeri için gelecek yıl NOI pozitif olmalı.');
      return finite(noi / input.exitCapRate * (1 - ratio(input.sellingCostRate, 'sellingCostRate')), 'terminalValue');
    }
    if (input.method !== 'gordon') throw new FinancialInputError('INVALID_TERMINAL', 'terminal.method', 'Terminal yöntemi desteklenmiyor.');
    validRate(input.discountRate); finite(input.growth, 'terminal.growth');
    if (input.growth <= -1 || input.discountRate <= input.growth) throw new FinancialInputError('INVALID_GORDON', 'terminal', 'Gordon modeli için -1 < büyüme < iskonto oranı gerekli.');
    return finite(finite(input.lastCashFlow, 'lastCashFlow') * (1 + input.growth) / (input.discountRate - input.growth), 'terminalValue');
  });
}
export function calculateDcf(annualFlows: readonly number[], discountRate: number, terminalValue: number): SkillResult<{ forecastPv: number; terminalPv: number; value: number }> {
  return attempt(() => { validRate(discountRate); if (!Array.isArray(annualFlows) || !annualFlows.length) throw new FinancialInputError('REQUIRED_FIELD', 'annualFlows', 'En az bir yıllık nakit akışı gerekli.');
    const forecastPv = finite(annualFlows.reduce((sum, flow, i) => sum + finite(flow, `annualFlows.${i}`) / (1 + discountRate) ** (i + 1), 0), 'forecastPv');
    const terminalPv = finite(finite(terminalValue, 'terminalValue') / (1 + discountRate) ** annualFlows.length, 'terminalPv');
    return { forecastPv, terminalPv, value: finite(forecastPv + terminalPv, 'dcfValue') }; });
}
export type IrrResult = Readonly<{ status: 'UNIQUE'; rate: number }> | Readonly<{ status: 'NO_ROOT' | 'NON_CONVENTIONAL' | 'OUTSIDE_SEARCH_RANGE'; rate: null }>;
/** One initial outflow and subsequent nonnegative inflows have at most one IRR.
 * Multi-sign-change flows are explicitly reported as non-conventional, never assigned an arbitrary root.
 */
export function calculateIrr(flows: readonly number[]): SkillResult<IrrResult> {
  return attempt(() => {
    if (!Array.isArray(flows) || flows.length < 2) throw new FinancialInputError('REQUIRED_FIELD', 'cashFlows', 'IRR için en az iki dönem gerekli.');
    flows.forEach((flow, i) => finite(flow, `cashFlows.${i}`));
    if (!flows.some(v => v > 0) || !flows.some(v => v < 0)) return { status: 'NO_ROOT', rate: null };
    if (flows[0] >= 0 || flows.slice(1).some(v => v < 0)) return { status: 'NON_CONVENTIONAL', rate: null };
    // Scale and evaluate in log space: sign stays robust near r=-1 and large horizons.
    const scale = Math.max(...flows.map(Math.abs));
    const npvSign = (logBase: number) => {
      const terms = flows.map((flow, i) => flow === 0 ? -Infinity : Math.log(Math.abs(flow) / scale) - i * logBase);
      const maximum = Math.max(...terms);
      return flows.reduce((sum, flow, i) => sum + Math.sign(flow) * Math.exp(terms[i] - maximum), 0);
    };
    let low = Math.log(1e-12); let high = Math.log(1e12);
    if (npvSign(low) <= 0 || npvSign(high) >= 0) return { status: 'OUTSIDE_SEARCH_RANGE', rate: null };
    for (let i = 0; i < 200; i++) { const middle = (low + high) / 2; if (npvSign(middle) > 0) low = middle; else high = middle; }
    return { status: 'UNIQUE', rate: finite(Math.expm1((low + high) / 2), 'irr') };
  });
}
export function calculatePayback(initialInvestment: number, annualFlows: readonly number[], discountRate?: number): SkillResult<{ years: number | null; recovered: boolean }> {
  return attempt(() => {
    nonnegative(initialInvestment, 'initialInvestment'); if (!Array.isArray(annualFlows)) throw new FinancialInputError('REQUIRED_FIELD', 'annualFlows', 'Yıllık akışlar gerekli.');
    if (discountRate !== undefined) validRate(discountRate);
    let balance = -initialInvestment;
    if (!initialInvestment) return { years: 0, recovered: true };
    for (let i = 0; i < annualFlows.length; i++) { const flow = finite(annualFlows[i], `annualFlows.${i}`) / (discountRate === undefined ? 1 : (1 + discountRate) ** (i + 1));
      if (flow > 0 && (balance + flow >= 0 || nearlyEqual(balance + flow, 0))) return { years: i + Math.min(1, -balance / flow), recovered: true };
      balance = finite(balance + flow, 'cumulativeCashFlow'); }
    return { years: null, recovered: false };
  });
}
