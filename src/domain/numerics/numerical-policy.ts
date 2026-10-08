export const NUMERICAL_POLICY = Object.freeze({
  version: 'numerics.v1',
  ratioTolerance: 1e-10,
  relativeTolerance: 1e-10,
  moneyDisplayDigits: 2,
  occupancyDisplayDigits: 2,
});

export function nearlyEqual(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y)
    && Math.abs(x - y) <= NUMERICAL_POLICY.relativeTolerance * Math.max(1, Math.abs(x), Math.abs(y));
}

export function ratioEqual(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y)
    && Math.abs(x - y) <= NUMERICAL_POLICY.ratioTolerance;
}

// Raw input ranges are strict. Tolerances apply only to calculated comparisons.
export function parseNumericInput(value: unknown): number | undefined {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return undefined;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Sonlu bir sayı gerekli.');
    return value;
  }
  if (typeof value !== 'string' || !/^[+-]?\d+(?:[.,]\d+)?$/.test(value.trim())) {
    throw new TypeError('Binlik ayırıcı kullanmadan bir sayı girin.');
  }
  const parsed = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(parsed)) throw new TypeError('Sonlu bir sayı gerekli.');
  return parsed;
}

export function percentageToRatio(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError('Yüzde 0–100 arasında olmalı.');
  return value / 100;
}

export function percentagePointsToRatio(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Düşüş sonlu ve negatif olmayan yüzde puanı olmalı.');
  return value / 100;
}
