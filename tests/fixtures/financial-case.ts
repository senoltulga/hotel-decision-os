import type { FinancialCase } from '../../src/domain/finance/finance.types.ts';
export function financialCase(): FinancialCase {
  return { case: { schemaVersion: 'case.v1', id: 'hotel-finance', revision: 0, name: 'Örnek Otel', currency: 'USD', period: { start: '2026-01-01', end: '2026-12-31' }, minAdr: 130, maxAdr: 150, referenceAdr: 145, referenceOccupancy: .55,
    demand: { kind: 'linear-sensitivity', modelVersion: 'demand.v1', adrIncrease: 5, occupancyDecreasePp: 2, validMinAdr: 130, validMaxAdr: 150 } },
    capacity: { roomCount: 100, bedCount: 200, openDays: 365, unavailableRoomNights: 0 },
    otherRevenues: [{ name: 'F&B', fixedAnnual: 100000, perOccupiedRoomNight: 20 }],
    costs: { fixedOpex: 1000000, variablePerOccupiedRoomNight: 30, variableRevenueRate: .05, managementFeeRate: .03, propertyExpenses: 100000, nonOperatingIncome: 0, replacementReserveRate: .04 },
    finance: { forecastHorizon: 3, discountRate: .1, capRate: .08, revenueGrowth: 0, costGrowth: 0, taxRate: 0, cashFlowMode: 'property', initialInvestment: 1000000,
      annualCapex: [10000, 10000, 10000], workingCapitalChanges: [0, 0, 0], annualDebtService: [0, 0, 0], terminal: { method: 'none' } },
  };
}
