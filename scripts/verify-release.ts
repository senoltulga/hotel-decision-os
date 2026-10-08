import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync('artifacts/validation/manifest.json','utf8')) as {sourceHashes:Record<string,string>;testHashes:Record<string,string>;scriptHashes:Record<string,string>;application:{file:string;sha256:string};passed:number;failed:number;totalTests:number};
for(const [path,hash] of Object.entries({...manifest.sourceHashes,...manifest.testHashes,...manifest.scriptHashes}))if(createHash('sha256').update(readFileSync(path)).digest('hex')!==hash)throw Error(`Artifact kanıtı güncel değil: ${path}`);
if(createHash('sha256').update(readFileSync(manifest.application.file)).digest('hex')!==manifest.application.sha256)throw Error('Paketlenmiş uygulama kanıtı güncel değil.');
if(manifest.failed!==0||manifest.passed!==manifest.totalTests)throw Error('Doğrulama başarısız.');
console.log(`Kaynak ve uygulama manifesti doğrulandı; ${manifest.passed} başarılı test.`);
