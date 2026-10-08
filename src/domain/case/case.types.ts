export type LinearSensitivityDemand = Readonly<{
  kind: 'linear-sensitivity'; modelVersion: 'demand.v1';
  adrIncrease: number; occupancyDecreasePp: number;
  validMinAdr: number; validMaxAdr: number;
}>;
export type ScenarioPointsDemand = Readonly<{
  kind: 'scenario-points'; modelVersion: 'demand.v1';
  points: readonly Readonly<{ adr: number; occupancy: number }>[];
}>;
export type DemandModel = LinearSensitivityDemand | ScenarioPointsDemand;

// Drafts may be incomplete; runtime validation is still required after storage/import.
export type HotelCaseDraft = Readonly<{
  schemaVersion: 'case.v1'; id: string; revision: number;
  name?: string; currency?: string;
  period?: Readonly<{ start?: string; end?: string }>;
  referenceAdr?: number; referenceOccupancy?: number;
  minAdr?: number; maxAdr?: number; minOccupancy?: number;
  demand?: DemandModel; assumptionNotes?: string;
}>;

export type ValidatedCase = HotelCaseDraft & Readonly<{
  name: string; currency: string;
  period: Readonly<{ start: string; end: string }>;
  minAdr: number; maxAdr: number; demand: DemandModel;
}>;

export type Issue = Readonly<{ code: string; path: string; message: string }>;
export type ValidationResult<T> =
  | Readonly<{ success: true; data: T; issues: readonly [] }>
  | Readonly<{ success: false; issues: readonly Issue[] }>;
