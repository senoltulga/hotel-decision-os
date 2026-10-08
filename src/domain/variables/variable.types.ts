export type Metric = 'adr' | 'occupancy' | 'revpar';
export type VariableRole = 'decision' | 'fixed' | 'exogenous' | 'constraint' | 'derived' | 'objective';
export type VariableDefinition = Readonly<{
  metric: Metric;
  unit: 'money-per-room-night' | 'ratio';
  roles: readonly VariableRole[];
}>;
export const MAX_REVPAR_VARIABLES: readonly VariableDefinition[] = Object.freeze([
  Object.freeze({ metric: 'adr', unit: 'money-per-room-night', roles: Object.freeze(['decision'] as const) }),
  Object.freeze({ metric: 'occupancy', unit: 'ratio', roles: Object.freeze(['derived', 'constraint'] as const) }),
  Object.freeze({ metric: 'revpar', unit: 'money-per-room-night', roles: Object.freeze(['derived', 'objective'] as const) }),
]);

export const FINANCIAL_VARIABLE_ROLES = Object.freeze({
  adr: ['decision'], openDays: ['decision'], capexTiming: ['decision'], fixedOpex: ['fixed','decision'],
  discountRate: ['exogenous'], capRate: ['exogenous'], exitCapRate: ['exogenous'], revenueGrowth: ['exogenous'], costGrowth: ['exogenous'],
  serviceQuality: ['fixed','constraint'], riskScore: ['fixed','objective'], minOccupancy: ['constraint'], dscr: ['derived','constraint'],
  revpar: ['derived','objective'], roomRevenue: ['derived'], totalRevenue: ['derived'], opex: ['derived','objective'],
  gop: ['derived'], ebitda: ['derived'], noi: ['derived','objective'], cashFlow: ['derived'], npv: ['derived','objective'],
  propertyValue: ['derived','objective'], irr: ['derived'], payback: ['derived','objective'],
} satisfies Record<string, readonly VariableRole[]>);
