import './build-simulation.ts';
import './build-workbench.ts';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { financialCase } from '../tests/fixtures/financial-case.ts';
import { buildMaxRevparProblem } from '../src/domain/problems/max-revpar.builder.ts';
import { solveMaxRevpar } from '../src/domain/solvers/max-revpar.solver.ts';
import { explainRevparResult } from '../src/domain/results/result.explainer.ts';
import { evaluateInvestmentCase } from '../src/domain/finance/financial.engine.ts';
import { runAnalysis } from '../src/features/workbench/analysis.runner.ts';
import type { AnalysisControls } from '../src/features/workbench/analysis.runner.ts';
import { ANALYSIS_TEMPLATES } from '../src/domain/templates/analysis.templates.ts';
import { createPriceOptions } from '../src/domain/optimization/optimization.engine.ts';
import { applyScenarioPatches } from '../src/domain/simulation/scenario.engine.ts';
import { unwrap } from '../src/domain/skills/financial.skills.ts';
import { createModelDraft } from '../src/domain/lifecycle/model.lifecycle.ts';
import { serializeCaseDocument } from '../src/domain/case/case.repository.ts';

const validation='artifacts/validation';mkdirSync(validation,{recursive:true});
const tests=readdirSync('tests/unit').filter(name=>name.endsWith('.test.ts')).sort().map(name=>`tests/unit/${name}`);
for(const [file,args] of [['typecheck.txt',['node_modules/typescript/bin/tsc','--noEmit']],['test-results.tap',['--test','--test-reporter=tap',...tests]]] as const) {
  const result=spawnSync(process.execPath,[...args],{encoding:'utf8'});writeFileSync(`${validation}/${file}`,`${result.stdout??''}${result.stderr??''}\nExit code: ${result.status}\n`);
  if(result.status!==0)throw Error(`${file} başarısız: ${result.error??result.stderr}`);
}
const tap=readFileSync(`${validation}/test-results.tap`,'utf8');const total=Number(tap.match(/# tests (\d+)/)?.[1]);const passed=Number(tap.match(/# pass (\d+)/)?.[1]);const failed=Number(tap.match(/# fail (\d+)/)?.[1]);
if(!total||total!==passed||failed)throw Error('Test raporu tutarsız.');
const input=financialCase();const built=buildMaxRevparProblem(input.case);if(!built.success)throw Error('Referans Case hazır değil.');
const solution=solveMaxRevpar(built.problem);if(solution.status!=='OPTIMAL')throw Error('Referans çözücü başarısız.');
const base={name:'Baz',financialCase:input,adr:145,depth:'investment' as const};
const options=unwrap(createPriceOptions(130,150,.5,.2,.8));
const controls:AnalysisControls={adr:145,alternativeAdr:150,options,constraints:[],
  scenarios:[base,unwrap(applyScenarioPatches(base,[{path:'financialCase.case.referenceOccupancy',value:.45},{path:'financialCase.costs.fixedOpex',value:1200000}],'Muhafazakâr')),unwrap(applyScenarioPatches(base,[{path:'adr',value:141.25},{path:'financialCase.case.referenceOccupancy',value:.65}],'İyimser'))],
  sensitivity:{path:'financialCase.finance.discountRate',values:[.05,.1,.15]},stress:{adrChange:-.1,occupancyDropPp:10,opexChange:.2,discountIncreasePp:4}};
const analyses=Object.fromEntries(ANALYSIS_TEMPLATES.map(template=>[template.id,unwrap(runAnalysis(template,input,controls))]));
const operating=unwrap(evaluateInvestmentCase(input,145));
const mapping:Record<string,{title:string;files:readonly string[];example:unknown}>={
  T05:{title:'Analitik MAX RevPAR çözücüsü',files:['src/domain/solvers/max-revpar.solver.ts','tests/unit/t05.test.ts'],example:solution},
  T06:{title:'Sonuç ve açıklama katmanı',files:['src/domain/results/result.explainer.ts','tests/unit/t05.test.ts'],example:explainRevparResult(solution)},
  T07:{title:'Guided Wizard, Case saklama ve kullanıcı akışı',files:['src/domain/guide/decision.guide.ts','src/domain/case/case.repository.ts','src/features/workbench/workbench.ui.ts','tests/unit/workbench.test.ts'],example:{caseDocument:JSON.parse(unwrap(serializeCaseDocument(input))),toolTemplates:ANALYSIS_TEMPLATES}},
  T08:{title:'Grafikler, kullanıcı akışı ve bütünleşik uygulama',files:['src/features/workbench/index.template.html','src/features/workbench/workbench.ui.ts','tests/unit/workbench.test.ts'],example:{application:'dist/index.html',supportedTools:ANALYSIS_TEMPLATES.map(template=>template.id)}},
  T09:{title:'Gelir, gider, GOP, EBITDA, NOI ve yatırım skill kütüphanesi',files:['src/domain/skills/financial.skills.ts','src/domain/skills/valuation.skills.ts','src/domain/finance/financial.engine.ts','tests/unit/finance.test.ts'],example:operating},
  T10:{title:'What-if, A/B, senaryo, duyarlılık ve stres',files:['src/domain/simulation/scenario.engine.ts','tests/unit/analysis.test.ts'],example:Object.fromEntries(Object.entries(analyses).filter(([id])=>['what-if','ab','scenarios','sensitivity','stress'].includes(id)))},
  T11:{title:'Maksimizasyon, minimizasyon ve Pareto',files:['src/domain/optimization/optimization.engine.ts','src/domain/templates/analysis.templates.ts','tests/unit/analysis.test.ts','tests/unit/workbench.test.ts'],example:Object.fromEntries(Object.entries(analyses).filter(([id])=>!['what-if','ab','scenarios','sensitivity','stress'].includes(id)))},
  T12:{title:'Tarihsel talep, AI sınırı, yaşam döngüsü ve kapanış denetimi',files:['src/domain/skills/historical-demand.skill.ts','src/domain/guide/ai-assistant.adapter.ts','src/domain/lifecycle/model.lifecycle.ts','tests/unit/assistant.test.ts','tests/unit/lifecycle.test.ts'],example:{lifecycle:unwrap(createModelDraft('max-revpar-flow','1.0')),lockEligibility:'Automated checks pass; explicit acceptance is needed for permanent LOCK.'}},
};
for(const [task,record] of Object.entries(mapping)) {
  mkdirSync(`artifacts/${task}`,{recursive:true});writeFileSync(`artifacts/${task}/example.json`,JSON.stringify(record.example,null,2)+'\n');
  writeFileSync(`artifacts/${task}/REPORT.md`,`# ${task} — ${record.title}\n\nTarih: 7 Ekim 2026. Durum: kodlandı ve otomatik testlerle doğrulandı. Kalıcı LOCK kaydı değildir.\n\n## Kod ve test kapsamı\n\n${record.files.map(file=>`- [${file}](../../${file})`).join('\n')}\n\n## Gerçek kanıt\n\n- [Örnek çıktı](example.json)\n- [Tüm testler](../validation/test-results.tap): ${total} test, ${passed} başarılı, ${failed} başarısız.\n- [Strict tip kontrolü](../validation/typecheck.txt): başarılı.\n- [Kaynak ve build hash manifesti](../validation/manifest.json).\n\nİlgili modül testleri ve kullanıcı akışları manifestte listelenir. UI kanıtı JSDOM etkileşim testidir; gerçek tarayıcı ekran görüntüsü veya uzman finansal kabulü yerine geçmez.\n\n## Yeniden üretme\n\nNode.js 24+ ile proje kökünde \`npm run artifact:all\`. Finansal varsayım ve kapsam sınırları [finans sözleşmesinde](../../FINANCIAL_MODEL_CONTRACT.md) açıklanır.\n`);
}
copyFileSync('dist/index.html','artifacts/T07/workbench.html');
const sourceFiles=(readdirSync('src',{recursive:true}) as string[]).filter(path=>/\.(ts|html)$/.test(path)).sort();
const sha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
const scriptFiles=readdirSync('scripts').filter(path=>path.endsWith('.ts')).sort().map(path=>`scripts/${path}`);
writeFileSync(`${validation}/manifest.json`,JSON.stringify({date:'2026-10-07',runtime:process.version,totalTests:total,passed,failed,tools:ANALYSIS_TEMPLATES.map(template=>template.id),tasks:Object.fromEntries(Object.entries(mapping).map(([task,record])=>[task,{title:record.title,files:record.files}])),tests,sourceHashes:Object.fromEntries(sourceFiles.map(path=>[`src/${path}`,sha(`src/${path}`)])),testHashes:Object.fromEntries(tests.map(path=>[path,sha(path)])),scriptHashes:Object.fromEntries(scriptFiles.map(path=>[path,sha(path)])),application:{file:'dist/index.html',sha256:sha('dist/index.html')},lockStatus:'ELIGIBLE_FOR_REVIEW_NOT_LOCKED',limitations:['No real-browser screenshot: computer-use permissions unavailable.','IRR reports non-conventional cash flows instead of choosing an arbitrary root.','Non-RevPAR optimization is exact over explicit finite alternatives.','AI adapter is optional; no provider is configured by default.']},null,2)+'\n');
writeFileSync(`${validation}/all-analysis-examples.json`,JSON.stringify(analyses,null,2)+'\n');
console.log(`Bütün modüller: ${total} test geçti. T05–T12 artifact, build ve manifest üretildi.`);
