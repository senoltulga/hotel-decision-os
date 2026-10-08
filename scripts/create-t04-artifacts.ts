import './build-simulation.ts';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildMaxRevparProblem } from '../src/domain/problems/max-revpar.builder.ts';

mkdirSync('artifacts/T04', { recursive: true });
const tests = readdirSync('tests/unit').filter(name => name.endsWith('.test.ts')).sort().map(name => `tests/unit/${name}`);
for (const [file, args] of [
  ['typecheck.txt', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['test-results.tap', ['--test', '--test-reporter=tap', ...tests]],
] as const) {
  const result = spawnSync(process.execPath, [...args], { encoding: 'utf8' });
  writeFileSync(`artifacts/T04/${file}`, `${result.stdout ?? ''}${result.stderr ?? ''}\nExit code: ${result.status}\n`);
  if (result.status !== 0) throw new Error(`${file} başarısız: ${result.error ?? result.stderr}`);
}
const input = { schemaVersion: 'case.v1', id: 'example-hotel', revision: 1, name: 'Örnek Otel', currency: 'USD',
  period: { start: '2026-01-01', end: '2026-12-31' }, minAdr: 130, maxAdr: 150, referenceAdr: 145, referenceOccupancy: .55,
  demand: { kind: 'linear-sensitivity', modelVersion: 'demand.v1', adrIncrease: 5, occupancyDecreasePp: 2, validMinAdr: 130, validMaxAdr: 150 } };
const ready = buildMaxRevparProblem(input);
if (!ready.success) throw new Error(JSON.stringify(ready.issues));
writeFileSync('artifacts/T04/problem.json', JSON.stringify(ready.problem, null, 2) + '\n');
writeFileSync('artifacts/T04/example.json', JSON.stringify({ runtime: process.version,
  ready: { input, output: ready },
  incomplete: buildMaxRevparProblem({ ...input, demand: undefined }),
  blocked: buildMaxRevparProblem({ ...input, referenceOccupancy: .99 }),
  validButInfeasibleWarning: buildMaxRevparProblem({ ...input, minOccupancy: .7 }),
}, null, 2) + '\n');
console.log('T04: problem.json, örnekler, tip kontrolü ve test kanıtları kaydedildi.');
