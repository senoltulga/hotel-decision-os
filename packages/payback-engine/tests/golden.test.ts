import { test } from "node:test";
import assert from "node:assert/strict";
import { baseAssumptions, investment, monthsOf, run, scenario } from "../src/index.ts";

const near = (a: number, b: number, tol: number) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} !~ ${b} (±${tol})`);

test("yatırım toplamı 10,75M USD", () => {
  assert.equal(investment(baseAssumptions()), 10_750_000);
});

test("geri dönüş: baz 11,69 / güçlü 10,56 / temkinli 13,26 yıl", () => {
  near(run(scenario("baz")).pay!, 11.69, 0.005);
  near(run(scenario("guclu")).pay!, 10.56, 0.005);
  near(run(scenario("temkinli")).pay!, 13.26, 0.005);
});

test("baz 3. yıl net işletme nakdi 871.213", () => {
  near(run(baseAssumptions()).rows[2].net, 871_213, 1);
});

test("aylık toplam = yıllık (1., 3., 8. yıl)", () => {
  const s = baseAssumptions();
  const r = run(s);
  for (const y of [1, 3, 8]) {
    const m = monthsOf(s, r, y);
    const sum = (k: "res" | "gr" | "gop" | "noi" | "net") => m.reduce((a, x) => a + x[k], 0);
    const row = r.rows[y - 1];
    for (const k of ["res", "gr", "gop", "noi", "net"] as const) near(sum(k), row[k], 1e-6);
  }
});

test("geri dönmeyen senaryoda pay = null", () => {
  const s = baseAssumptions();
  s.buy = 1e10;
  assert.equal(run(s).pay, null);
});
