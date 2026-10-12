export interface Assumptions {
  /** Doluluk %, ilk 3 yıl (4. yıl+ sabit = 3. yıl) */
  occ: [number, number, number];
  /** ADR USD, ilk 3 yıl */
  adr: [number, number, number];
  /** 3. yıl ticari kira (USD/yıl) */
  com3: number;
  /** 3. yıl restoran+havuz (USD/yıl) */
  rest3: number;
  /** Satın alma bedeli */
  buy: number;
  /** İşletme sermayesi */
  wc: number;
  /** Residence gelirine oranlar (%) */
  r_com: number;
  r_ops: number;
  r_hk: number;
  r_mnt: number;
  /** FF&E rezervi, brüt gelirin % */
  r_ffe: number;
  /** 3. yıl sabit giderler ve malik payı */
  fix3: number;
  own3: number;
  /** 3. yıl sonrası gelir artışı % (ADR üzerinden) ve sabit gider artışı % */
  g: number;
  fg: number;
  /** Yenileme kalemleri (kod -> USD) */
  reno: Record<string, number>;
  /** Aylık mevsimsellik endeksi (12) */
  seas: number[];
}

export interface YearRow {
  y: number;
  res: number; c: number; r: number; gr: number;
  com: number; ops: number; hk: number; mnt: number; fx: number;
  gop: number; ow: number; noi: number; ffe: number; net: number; cum: number;
}

export interface RunResult {
  rows: YearRow[];
  /** Geri dönüş süresi (yıl, doğrusal ara değer) veya null (ufukta dönmüyor) */
  pay: number | null;
  inv: number;
}

export interface MonthRow {
  occ: number; adr: number;
  res: number; c: number; r: number; gr: number;
  com: number; ops: number; hk: number; mnt: number; fx: number;
  gop: number; ow: number; noi: number; ffe: number; net: number;
}
