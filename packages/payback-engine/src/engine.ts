import type { Assumptions, MonthRow, RunResult, YearRow } from "./types.ts";

export const UNITS = 18;
export const DAYS = 365;
export const HORIZON = 40;
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Rapordaki 1–3. yıl oranları (3. yıl = 1.0) */
const COM_R = [165 / 180, 175 / 180, 1];
const REST_R = [125 / 150, 140 / 150, 1];
const FIX_R = [138700 / 169900, 154450 / 169900, 1];
const OWN_R = [60 / 70, 65 / 70, 1];

export const RENO_ITEMS: Record<string, number> = {
  A1: 450000, A2: 200000, A3: 260000, A4: 130000, A5: 110000,
  B1: 150000, B2: 120000, B3: 120000, B4: 90000, B5: 70000,
  C1: 140000, C2: 110000, C3: 75000, C4: 80000, C5: 45000,
  D1: 85000, D2: 55000, D3: 45000, D4: 165000,
};

export function baseAssumptions(): Assumptions {
  return {
    occ: [45, 55, 65], adr: [250, 275, 300],
    com3: 180000, rest3: 150000, buy: 8100000, wc: 150000,
    r_com: 14, r_ops: 10, r_hk: 5, r_mnt: 5, r_ffe: 4,
    fix3: 169900, own3: 70000, g: 3, fg: 4,
    reno: { ...RENO_ITEMS },
    seas: [0.60, 0.62, 0.70, 0.85, 1.00, 1.15, 1.25, 1.28, 1.15, 0.95, 0.70, 0.65],
  };
}

/** Rapordaki temkinli / güçlü senaryolar (kira oranı çarpanı ile) */
export function scenario(name: "baz" | "temkinli" | "guclu"): Assumptions {
  const s = baseAssumptions();
  const f = name === "temkinli" ? 0.93 : name === "guclu" ? 1.05 : 1;
  if (name === "temkinli") { s.occ = [40, 50, 60]; s.adr = [235, 260, 285]; }
  if (name === "guclu") { s.occ = [50, 60, 68]; s.adr = [265, 290, 320]; }
  s.com3 *= f; s.rest3 *= f;
  return s;
}

export function renoTotal(s: Assumptions): number {
  return Object.values(s.reno).reduce((a, b) => a + b, 0);
}

export function investment(s: Assumptions): number {
  return s.buy + renoTotal(s) + s.wc;
}

export function run(s: Assumptions): RunResult {
  const rows: YearRow[] = [];
  const inv = investment(s);
  const res3 = UNITS * DAYS * (s.occ[2] / 100) * s.adr[2];
  let cum = 0;
  let pay: number | null = null;
  for (let y = 0; y < HORIZON; y++) {
    let res: number, c: number, r: number, fx: number, ow: number;
    if (y < 3) {
      res = UNITS * DAYS * (s.occ[y] / 100) * s.adr[y];
      c = s.com3 * COM_R[y]; r = s.rest3 * REST_R[y];
      fx = s.fix3 * FIX_R[y]; ow = s.own3 * OWN_R[y];
    } else {
      const k = y - 2;
      const gg = Math.pow(1 + s.g / 100, k), fg = Math.pow(1 + s.fg / 100, k);
      res = res3 * gg; c = s.com3 * gg; r = s.rest3 * gg;
      fx = s.fix3 * fg; ow = s.own3 * fg;
    }
    const gr = res + c + r;
    const com = res * s.r_com / 100, ops = res * s.r_ops / 100;
    const hk = res * s.r_hk / 100, mnt = res * s.r_mnt / 100;
    const gop = gr - com - ops - hk - mnt - fx;
    const noi = gop - ow, ffe = gr * s.r_ffe / 100, net = noi - ffe;
    const prev = cum; cum += net;
    if (pay === null && cum >= inv && net > 0) pay = y + (inv - prev) / net;
    rows.push({ y: y + 1, res, c, r, gr, com, ops, hk, mnt, fx, gop, ow, noi, ffe, net, cum });
  }
  return { rows, pay, inv };
}

/** Yıl bazında doluluk (%) ve ADR: 4. yıl+ doluluk sabit, ADR g ile artar */
export function yearDrivers(s: Assumptions, y: number): { occ: number; adr: number } {
  if (y <= 3) return { occ: s.occ[y - 1], adr: s.adr[y - 1] };
  return { occ: s.occ[2], adr: s.adr[2] * Math.pow(1 + s.g / 100, y - 3) };
}

export function avgSeasonality(s: Assumptions): number {
  let t = 0;
  for (let m = 0; m < 12; m++) t += s.seas[m] * MONTH_DAYS[m];
  return t / DAYS;
}

/** Yılın aylık dağılımı; 12 ayın toplamı yıllık satırla eşittir. */
export function monthsOf(s: Assumptions, result: RunResult, y: number): MonthRow[] {
  const r = result.rows[y - 1];
  const d = yearDrivers(s, y);
  const a = avgSeasonality(s) || 1;
  const out: MonthRow[] = [];
  for (let m = 0; m < 12; m++) {
    const occm = d.occ * s.seas[m] / a;
    const res = UNITS * MONTH_DAYS[m] * (occm / 100) * d.adr;
    const c = r.c / 12, rs = r.r / 12, gr = res + c + rs;
    const com = res * s.r_com / 100, ops = res * s.r_ops / 100;
    const hk = res * s.r_hk / 100, mnt = res * s.r_mnt / 100, fx = r.fx / 12;
    const gop = gr - com - ops - hk - mnt - fx, ow = r.ow / 12;
    const noi = gop - ow, ffe = gr * s.r_ffe / 100, net = noi - ffe;
    out.push({ occ: occm, adr: d.adr, res, c, r: rs, gr, com, ops, hk, mnt, fx, gop, ow, noi, ffe, net });
  }
  return out;
}
