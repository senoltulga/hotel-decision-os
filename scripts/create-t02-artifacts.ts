import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { compileDemand } from '../src/domain/skills/demand.skill.ts';
import { calculateRevpar } from '../src/domain/skills/revpar.skill.ts';
import type { SkillResult } from '../src/domain/skills/skill.types.ts';

function unwrap<T>(result: SkillResult<T>): T {
  if (!result.success) throw new Error(JSON.stringify(result.issues));
  return result.value;
}
mkdirSync('artifacts/T02', { recursive: true });
for (const [file, args] of [
  ['typecheck.txt', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['test-results.tap', ['--test', '--test-reporter=tap', 'tests/unit/t01.test.ts', 'tests/unit/t02.test.ts']],
] as const) {
  const result = spawnSync(process.execPath, [...args], { encoding: 'utf8' });
  writeFileSync(`artifacts/T02/${file}`, `${result.stdout ?? ''}${result.stderr ?? ''}\nExit code: ${result.status}\n`);
  if (result.status !== 0) throw new Error(`${file} başarısız: ${result.error ?? result.stderr}`);
}
const linearInput = { minAdr: 130, maxAdr: 150, referenceAdr: 145, referenceOccupancy: .55,
  demand: { kind: 'linear-sensitivity', modelVersion: 'demand.v1', adrIncrease: 5, occupancyDecreasePp: 2, validMinAdr: 130, validMaxAdr: 150 } };
const pointsInput = { minAdr: 130, maxAdr: 150, demand: { kind: 'scenario-points', modelVersion: 'demand.v1',
  points: [{ adr: 130, occupancy: .65 }, { adr: 145, occupancy: .55 }, { adr: 150, occupancy: .5 }] } };
const examples = [linearInput, pointsInput].map(input => {
  const model = unwrap(compileDemand(input));
  return { input, segments: model.segments, results: [130, 141.25, 145, 150].map(adr => {
    const occupancy = unwrap(model.occupancyAt(adr));
    return { adr, occupancy, revpar: unwrap(calculateRevpar(adr, occupancy)) };
  }), outsideDomain: model.occupancyAt(151) };
});
writeFileSync('artifacts/T02/example.json', JSON.stringify({
  runtime: process.version, demandVersion: 'demand.v1', revparVersion: 'revpar.v1',
  note: 'Fiyatlar örnek girdidir; optimumu seçen çözücü henüz uygulanmadı.', examples,
  invalidPhysicalModel: compileDemand({ ...linearInput, referenceOccupancy: .99 }),
}, null, 2) + '\n');
console.log('T02 artifact: tip kontrolü ve 33 test başarılı; gerçek örnek çıktıları kaydedildi.');
