import type { HotelCaseDraft } from '../case/case.types.ts';

export type Capacity = Readonly<{ roomCount: number; bedCount?: number; openDays: number; unavailableRoomNights: number; unavailableReason?: string }>;
export type RevenueStream = Readonly<{ name: string; fixedAnnual: number; perOccupiedRoomNight: number }>;
export type OperatingCosts = Readonly<{
  fixedOpex: number; variablePerOccupiedRoomNight: number; variableRevenueRate: number;
  managementFeeRate: number; propertyExpenses: number; nonOperatingIncome: number; replacementReserveRate: number;
}>;
export type FinanceAssumptions = Readonly<{
  forecastHorizon: number; discountRate: number; capRate: number;
  revenueGrowth: number; costGrowth: number; taxRate: number;
  cashFlowMode: 'property' | 'equity'; initialInvestment: number;
  annualCapex: readonly number[]; workingCapitalChanges: readonly number[]; annualDebtService: readonly number[];
  terminalDebtBalance?: number;
  terminal: Readonly<{ method: 'none' }> | Readonly<{ method: 'exit-cap'; exitCapRate: number; noiGrowth: number; sellingCostRate: number }>
    | Readonly<{ method: 'gordon'; growth: number }> | Readonly<{ method: 'explicit'; amount: number }>;
}>;
export type FinancialCase = Readonly<{
  case: HotelCaseDraft; capacity: Capacity; otherRevenues: readonly RevenueStream[];
  costs: OperatingCosts; finance: FinanceAssumptions;
}>;
export type OperatingMetrics = Readonly<{
  adr: number; occupancy: number; availableRoomNights: number; occupiedRoomNights: number; revpar: number;
  roomRevenue: number; otherRevenue: number; totalRevenue: number; opex: number; gop: number;
  managementFee: number; propertyExpenses: number; ebitda: number; replacementReserve: number; noi: number;
}>;
