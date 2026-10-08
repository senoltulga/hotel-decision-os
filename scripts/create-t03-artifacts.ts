import './build-simulation.ts';
import { readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { checkMaxRevparReadiness } from '../src/domain/readiness/readiness.engine.ts';
import { simulatePrice } from '../src/domain/simulation/simulate-price.ts';

const tests = readdirSync('tests/unit').filter(name => name.endsWith('.test.ts')).sort().map(name => `tests/unit/${name}`);
for (const [file, args] of [
  ['typecheck.txt', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['test-results.tap', ['--test', '--test-reporter=tap', ...tests]],
] as const) {
  const result = spawnSync(process.execPath, [...args], { encoding: 'utf8' });
  writeFileSync(`artifacts/T03/${file}`, `${result.stdout ?? ''}${result.stderr ?? ''}\nExit code: ${result.status}\n`);
  if (result.status !== 0) throw new Error(`${file} başarısız: ${result.error ?? result.stderr}`);
}
const input = { schemaVersion: 'case.v1', id: 'example-hotel', revision: 0, name: 'Örnek Otel', currency: 'USD',
  period: { start: '2026-01-01', end: '2026-12-31' }, minAdr: 130, maxAdr: 150, referenceAdr: 145, referenceOccupancy: .55,
  demand: { kind: 'linear-sensitivity', modelVersion: 'demand.v1', adrIncrease: 5, occupancyDecreasePp: 2, validMinAdr: 130, validMaxAdr: 150 } };
const ready = simulatePrice(input, 141.25);
const constrained = simulatePrice({ ...input, minOccupancy: .6 }, 145);
writeFileSync('artifacts/T03/example.json', JSON.stringify({ runtime: process.version,
  ready: { input, readiness: ready.readiness, selected: ready.selected },
  incomplete: checkMaxRevparReadiness({ ...input, demand: undefined }),
  blocked: checkMaxRevparReadiness({ ...input, referenceOccupancy: .99 }),
  infeasibilityWarning: checkMaxRevparReadiness({ ...input, minOccupancy: .7 }),
  selectedPriceViolation: { readiness: constrained.readiness, selected: constrained.selected },
}, null, 2) + '\n');
console.log('T03 artifact, tip kontrolü, test kanıtı ve örnekler kaydedildi.');
