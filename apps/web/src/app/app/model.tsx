"use client";
import { useMemo, useState } from "react";
import { baseAssumptions, run, type Assumptions } from "@hotel-decision-os/payback-engine";

const f = (n: number) => Math.round(n).toLocaleString("tr-TR");

export default function Model({ email }: { email: string }) {
  const [s, setS] = useState<Assumptions>(baseAssumptions);
  const r = useMemo(() => run(s), [s]);
  const set = (patch: Partial<Assumptions>) => setS((p) => ({ ...p, ...patch }));
  const arr = (k: "occ" | "adr", i: number, v: number) =>
    set({ [k]: s[k].map((x, j) => (j === i ? v : x)) as [number, number, number] });
  return (
    <>
      <p style={{ textAlign: "right" }}>{email}</p>
      <h1>Geri dönüş süresi: {r.pay === null ? "40+ yıl" : r.pay.toFixed(1).replace(".", ",") + " yıl"}</h1>
      <p>Toplam yatırım: {f(r.inv)} USD</p>
      <fieldset>
        <legend>Doluluk % / ADR (1–3. yıl)</legend>
        {[0, 1, 2].map((i) => (
          <div key={i}>
            {i + 1}. yıl{" "}
            <input type="number" aria-label={`Doluluk ${i + 1}`} value={s.occ[i]} onChange={(e) => arr("occ", i, +e.target.value)} />{" "}
            <input type="number" aria-label={`ADR ${i + 1}`} value={s.adr[i]} onChange={(e) => arr("adr", i, +e.target.value)} />
          </div>
        ))}
      </fieldset>
      <table style={{ marginTop: 16, width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th>Yıl</th><th>Brüt gelir</th><th>NOI</th><th>Net nakit</th><th>Kümülatif</th></tr></thead>
        <tbody>
          {r.rows.slice(0, 12).map((x) => (
            <tr key={x.y}><td>{x.y}</td><td>{f(x.gr)}</td><td>{f(x.noi)}</td><td>{f(x.net)}</td><td>{f(x.cum)}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
