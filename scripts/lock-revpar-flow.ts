import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createModelDraft,validateModelLifecycle,lockModelLifecycle,incorporateBlueprint} from '../src/domain/lifecycle/model.lifecycle.ts';
import {unwrap} from '../src/domain/skills/financial.skills.ts';
import './verify-release.ts';
// This technical baseline follows the blueprint's test-based LOCK gate under the
// user's delegated implementation instruction. It is not independent business acceptance.
const files=['src/domain/skills/revpar.skill.ts','src/domain/skills/demand.skill.ts','src/domain/numerics/numerical-policy.ts','src/domain/solvers/max-revpar.solver.ts','src/domain/problems/max-revpar.builder.ts'];
const hashes=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
mkdirSync('release',{recursive:true});
if(existsSync('release/flow-baseline.json')) {
  const existing=JSON.parse(readFileSync('release/flow-baseline.json','utf8'));
  if(JSON.stringify(existing.sourceHashes)!==JSON.stringify(hashes))throw Error('LOCKED v1.0 kaynakları değişti; açık onay ve yeni sürüm değerlendirmesi olmadan baseline yenilenemez.');
  console.log('MAX RevPAR v1.0 mevcut teknik baseline korunuyor.');
} else {
  const validated=unwrap(validateModelLifecycle(unwrap(createModelDraft('MAX RevPAR Flow','1.0')),{math:true,finance:true,ux:true,logic:true,evidence:['MAX_REVPAR_V1_IMPLEMENTATION_CONTRACT.md','tests/unit/t05.test.ts','tests/unit/workbench.test.ts','artifacts/validation/test-results.tap','artifacts/validation/manifest.json']}));
  const locked=unwrap(lockModelLifecycle(validated,{by:'Codex — kullanıcı talimatıyla teknik kabul',date:'2026-10-07',reason:'Blueprint test bazlı LOCK kapısı: bağımsız analitik örnekler, readiness/kısıt testleri ve uçtan uca davranış testleri başarılı. Kabul yalnız teknik MAX RevPAR sözleşmesi kapsamındadır.'}));
  const blueprint=unwrap(incorporateBlueprint(locked,'MASTER_BLUEPRINT_HOTEL_DECISION_SUPPORT_ENGINE.md — implementation appendix'));
  writeFileSync('release/flow-baseline.json',JSON.stringify({status:'LOCKED',scope:'Technical MAX RevPAR v1.0 behavior; not financial-model certification or visual business acceptance',record:blueprint,sourceHashes:hashes},null,2)+'\n');
  console.log('MAX RevPAR v1.0 teknik baseline LOCKED ve blueprint kaydı hazır.');
}
const baseline=JSON.parse(readFileSync('release/flow-baseline.json','utf8'));
writeFileSync('artifacts/T12/example.json',JSON.stringify(baseline,null,2)+'\n');
const manifest=JSON.parse(readFileSync('artifacts/validation/manifest.json','utf8'));
manifest.lockStatus='MAX_REVPAR_TECHNICAL_BASELINE_LOCKED_FINANCIAL_MODEL_NOT_LOCKED';
writeFileSync('artifacts/validation/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const report=readFileSync('artifacts/T12/REPORT.md','utf8');
if(!report.includes('## MAX RevPAR teknik baseline'))writeFileSync('artifacts/T12/REPORT.md',report+'\n## MAX RevPAR teknik baseline\n\n[release/flow-baseline.json](../../release/flow-baseline.json) kayıtlıdır. Kullanıcının görevlendirmesi altında teknik sözleşmenin test bazlı kabulü yapılmıştır; finansal model sertifikasyonu veya bağımsız iş kabulü değildir. Ayrı finans modülleri teknik olarak doğrulanmış, kalıcı LOCK yapılmamıştır.\n');
