import { ANALYSIS_TEMPLATES, findAnalysisTemplate } from '../../domain/templates/analysis.templates.ts';
import type { AnalysisTemplate } from '../../domain/templates/analysis.templates.ts';
import { recommendAnalysis, readinessForTemplate, startWizard, selectWizardTool, approveWizardTool, invalidateWizard, reviewWizard, completeWizard } from '../../domain/guide/decision.guide.ts';
import { parseNumericInput, percentageToRatio } from '../../domain/numerics/numerical-policy.ts';
import type { FinancialCase } from '../../domain/finance/finance.types.ts';
import { fitHistoricalDemand } from '../../domain/skills/historical-demand.skill.ts';
import { compileDemand } from '../../domain/skills/demand.skill.ts';
import { simulatePrice } from '../../domain/simulation/simulate-price.ts';
import type { RevparSolution } from '../../domain/solvers/max-revpar.solver.ts';
import { unwrap } from '../../domain/skills/financial.skills.ts';
import { createPriceOptions } from '../../domain/optimization/optimization.engine.ts';
import type { DecisionOption, MetricConstraint } from '../../domain/optimization/optimization.engine.ts';
import { runAnalysis } from './analysis.runner.ts';
import type { AnalysisControls, AnalysisOutput } from './analysis.runner.ts';
import { applyScenarioPatches } from '../../domain/simulation/scenario.engine.ts';
import type { ScenarioRequest } from '../../domain/simulation/scenario.engine.ts';
import { serializeCaseDocument, parseCaseDocument } from '../../domain/case/case.repository.ts';

type Field = Readonly<{ key: string; label: string; value?: string; hint?: string; type?: 'text' | 'date' | 'textarea' | 'select'; choices?: readonly [string, string][] }>;
const definitions: Record<string, readonly Field[]> = {
  case: [{ key: 'name', label: 'Otel adı' }, { key: 'currency', label: 'Para birimi', type: 'select', choices: [['USD','USD'],['TRY','TRY'],['EUR','EUR']] }, { key: 'start', label: 'Dönem başlangıcı', type: 'date' }, { key: 'end', label: 'Dönem bitişi', type: 'date' }],
  pricing: [{ key: 'demandKind', label: 'Talep modeli', type: 'select', choices: [['linear-sensitivity','Doğrusal duyarlılık'],['scenario-points','Senaryo noktaları'],['historical','Tarihsel uyum']] },
    { key: 'minAdr', label: 'Minimum ADR' }, { key: 'maxAdr', label: 'Maksimum ADR' }, { key: 'minOccupancy', label: 'Minimum doluluk (%) — isteğe bağlı' },
    { key: 'referenceAdr', label: 'Referans ADR' }, { key: 'referenceOccupancy', label: 'Referans doluluk (%)' }, { key: 'adrIncrease', label: 'Fiyat artışı' }, { key: 'occupancyDecreasePp', label: 'Bu artışta doluluk düşüşü (yüzde puanı)', hint: '5 USD artışta 2 yüzde puanı düşüş: %55 → %53.' }, { key: 'validMinAdr', label: 'Talep modelinin minimum fiyatı' }, { key: 'validMaxAdr', label: 'Talep modelinin maksimum fiyatı' },
    { key: 'points', label: 'Fiyat; doluluk (%) — satır başına bir nokta', type: 'textarea' }, { key: 'history', label: 'Fiyat; doluluk (%); sezon; kanal; segment', type: 'textarea', hint: 'En az üç gözlem; tek sezon, kanal ve segment. Tarihsel ilişki nedensellik değildir.' }],
  operating: [{ key: 'roomCount', label: 'Oda sayısı' }, { key: 'openDays', label: 'Açık gün sayısı' }, { key: 'unavailableRoomNights', label: 'Kullanılamayan oda geceleri', hint: 'Oda sayısı × kapalı gece toplamı; açık günlerden ayrıca düşülür.' }, { key: 'unavailableReason', label: 'Kullanılamayan kapasitenin nedeni' },
    { key: 'revenues', label: 'Diğer gelirler: isim; yıllık sabit tutar; satılan oda gecesi başına gelir', type: 'textarea', hint: 'F&B, spa, kira, ticari ve diğer gelirleri ayrı satırda girin. Yoksa boş bırakın.' },
    { key: 'fixedOpex', label: 'Yıllık sabit OPEX', hint: 'Personel, enerji, bakım, pazarlama gibi işletme giderlerinin sabit toplamı.' }, { key: 'variablePerOccupiedRoomNight', label: 'Satılan oda gecesi başına değişken gider' }, { key: 'variableRevenueRate', label: 'Toplam gelir üzerinden değişken gider (%)' }, { key: 'managementFeeRate', label: 'Yönetim ücreti (%)', hint: 'OPEX toplamına tekrar dahil etmeyin.' }, { key: 'propertyExpenses', label: 'Yıllık mülk giderleri', hint: 'İşletme OPEX’ine dahil edilmeyen mülk vergisi, sigorta vb.' }, { key: 'nonOperatingIncome', label: 'Diğer işletme dışı gelir' }, { key: 'replacementReserveRate', label: 'Yenileme rezervi (%)', hint: 'NOI’den ayrılır; aynı tutarı yıllık CapEx’e tekrar yazmayın.' }],
  investment: [{ key: 'forecastHorizon', label: 'Tahmin ufku (yıl)' }, { key: 'discountRate', label: 'İskonto oranı (%)' }, { key: 'capRate', label: 'Kapitalizasyon oranı (%)' }, { key: 'revenueGrowth', label: 'Yıllık gelir büyümesi (%)' }, { key: 'costGrowth', label: 'Yıllık gider büyümesi (%)' }, { key: 'taxRate', label: 'NOI üzerinden varsayılan etkin nakit vergi (%)', hint: 'Basitleştirilmiş senaryo varsayımıdır; vergi mevzuatı hesabı değildir.' }, { key: 'cashFlowMode', label: 'Nakit akışı bazı', type: 'select', choices: [['property','Mülk — borç öncesi'],['equity','Özkaynak — borç servisi sonrası']] }, { key: 'initialInvestment', label: 'Başlangıç yatırımı (t=0)' },
    { key: 'annualCapex', label: 'Yıllık ek CapEx — yıl başına bir değer (; ile)', hint: 'Tahmin ufku kadar sayı girin; 0 da açık bir girdidir.' }, { key: 'workingCapitalChanges', label: 'Yıllık işletme sermayesi değişimi (; ile)', hint: 'Pozitif değişim nakit çıkışı, negatif değişim nakit girişi.' }, { key: 'annualDebtService', label: 'Yıllık borç servisi (; ile)', hint: 'Borç yoksa her yıl 0. DSCR borç servisi 0 olduğunda tanımsızdır.' },
    { key: 'terminalMethod', label: 'Dönem sonu değer yöntemi', type: 'select', choices: [['none','Terminal değer yok'],['exit-cap','Gelecek yıl NOI / exit cap'],['gordon','Gordon büyüme modeli'],['explicit','Açık satış değeri']] }, { key: 'exitCapRate', label: 'Exit cap rate (%)' }, { key: 'noiGrowth', label: 'Terminal NOI büyümesi (%)' }, { key: 'sellingCostRate', label: 'Satış masrafı (%)' }, { key: 'terminalGrowth', label: 'Gordon büyümesi (%)' }, { key: 'terminalAmount', label: 'Açık dönem sonu değer tutarı' }, { key: 'terminalDebtBalance', label: 'Satış tarihinde kalan borç — özkaynak satış analizinde gerekli', hint: 'Exit-cap veya açık satış değeri brüt tutarından düşülür; Gordon özkaynak akışına tekrar düşülmez.' }],
  analysis: [{ key: 'adr', label: 'Baz / denenecek ADR' }, { key: 'alternativeAdr', label: 'Alternatif ADR' },
    { key: 'scenarioRows', label: 'Senaryo: isim; ADR; referans doluluk (%); sabit OPEX değişimi (%); iskonto (%)', type: 'textarea' },
    { key: 'sensitivityPath', label: 'Duyarlılık değişkeni', type: 'select', choices: [['financialCase.finance.discountRate','İskonto oranı (%)'],['financialCase.costs.fixedOpex','Sabit OPEX'],['adr','ADR'],['financialCase.finance.capRate','Cap rate (%)']] }, { key: 'sensitivityValues', label: 'Duyarlılık değerleri (; ile)' },
    { key: 'stressAdr', label: 'Stres: ADR değişimi (%)' }, { key: 'stressOccupancy', label: 'Stres: doluluk düşüşü (yüzde puanı)' }, { key: 'stressOpex', label: 'Stres: sabit OPEX artışı (%)' }, { key: 'stressDiscount', label: 'Stres: iskonto artışı (yüzde puanı)' },
    { key: 'optionMode', label: 'Karar seçenekleri', type: 'select', choices: [['grid','Fiyat aralığını belirtilen adımla değerlendir'],['manual','Açık işletme / yatırım seçenekleri']] }, { key: 'priceStep', label: 'Fiyat adımı', hint: 'Diğer hedefler bu açık fiyat kümesini karşılaştırır; yalnız MAX RevPAR sürekli aralığı analitik çözer.' }, { key: 'riskScore', label: 'Fiyat seçeneklerinin risk endeksi (%)', hint: 'Sizin verdiğiniz karşılaştırmalı puan; hesaplanmış olasılık değildir.' }, { key: 'serviceQuality', label: 'Fiyat seçeneklerinin hizmet kalite puanı (%)' },
    { key: 'optionRows', label: 'Seçenek: isim; ADR; sabit OPEX; başlangıç yatırımı; risk endeksi (%); kalite (%)', type: 'textarea' },
    { key: 'qualityMin', label: 'Minimum hizmet kalite puanı (%) — isteğe bağlı' }, { key: 'noiMin', label: 'Minimum NOI — isteğe bağlı' }, { key: 'dscrMin', label: 'Minimum DSCR — isteğe bağlı' }, { key: 'capexMax', label: 'Maksimum toplam yatırım/CapEx — isteğe bağlı' }],
};
const example: Record<string,string> = { name:'Örnek Otel',currency:'USD',start:'2026-01-01',end:'2026-12-31',demandKind:'linear-sensitivity',minAdr:'130',maxAdr:'150',referenceAdr:'145',referenceOccupancy:'55',adrIncrease:'5',occupancyDecreasePp:'2',validMinAdr:'130',validMaxAdr:'150',points:'130;65\n145;55\n150;50',history:'130;61;yaz;direkt;tatil\n145;55;yaz;direkt;tatil\n150;53;yaz;direkt;tatil',roomCount:'100',openDays:'365',unavailableRoomNights:'0',revenues:'F&B;100000;20',fixedOpex:'1000000',variablePerOccupiedRoomNight:'30',variableRevenueRate:'5',managementFeeRate:'3',propertyExpenses:'100000',nonOperatingIncome:'0',replacementReserveRate:'4',forecastHorizon:'3',discountRate:'10',capRate:'8',revenueGrowth:'0',costGrowth:'0',taxRate:'0',cashFlowMode:'property',initialInvestment:'1000000',annualCapex:'10000;10000;10000',workingCapitalChanges:'0;0;0',annualDebtService:'0;0;0',terminalMethod:'none',exitCapRate:'8',noiGrowth:'0',sellingCostRate:'2',terminalGrowth:'2',terminalAmount:'10000000',terminalDebtBalance:'0',adr:'145',alternativeAdr:'150',scenarioRows:'Muhafazakâr;145;45;20;14\nBaz;145;55;0;10\nİyimser;141,25;65;-5;8',sensitivityPath:'financialCase.finance.discountRate',sensitivityValues:'5;10;15',stressAdr:'-10',stressOccupancy:'10',stressOpex:'20',stressDiscount:'4',optionMode:'grid',priceStep:'0,5',riskScore:'20',serviceQuality:'80',optionRows:'Ekonomik;130;900000;800000;35;75\nDengeli;141,25;1000000;1000000;20;85\nPremium;150;1100000;1200000;10;95' };
const root = document.getElementById('hdse-workbench')!;
const part = (name:string) => root.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
const field = (key:string) => document.querySelector<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(`[data-field="${key}"]`)!;
const action = (name:string) => document.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
let state = startWizard(); let template:AnalysisTemplate = ANALYSIS_TEMPLATES[0]; let output:AnalysisOutput|undefined;
let caseId: string = globalThis.crypto?.randomUUID?.() ?? 'local-hotel-case';
const storageKey = 'hdse-workbench.form.v1';
function el(tag:string, text?:string) { const node = document.createElement(tag); if(text !== undefined) node.textContent=text; return node; }
function messages(target:HTMLElement, values:readonly string[]) { target.replaceChildren(...values.map(text => el('p',text))); }
function fields() { return Object.fromEntries([...document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('[data-field]')].map(input=>[input.dataset.field!,input.value])); }
function hydrate(values:Record<string,string>) { for(const [key,value] of Object.entries(values)) { if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key))continue; const input=document.querySelector<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(`[data-field="${key}"]`); if(input && typeof value==='string') input.value=value; } }
for(const [group, list] of Object.entries(definitions)) {
  const target=root.querySelector<HTMLElement>(`[data-group="${group}"]`)!;
  if(group==='operating') target.append(el('h3','Kapasite, gelir ve işletme giderleri'));
  if(group==='investment') target.append(el('h3','Nakit akışı ve değerleme varsayımları'));
  if(group==='analysis') target.append(el('h3','Analiz seçenekleri'));
  const grid=el('div');grid.className='grid';
  for(const definition of list) {
    const label=el('label');label.dataset.label=definition.key;label.append(el('span',definition.label));
    const input=definition.type==='textarea'?document.createElement('textarea'):definition.type==='select'?document.createElement('select'):document.createElement('input');input.dataset.field=definition.key;
    if(input instanceof HTMLInputElement) { input.type=definition.type==='date'?'date':'text'; if(!['name','unavailableReason'].includes(definition.key)) input.inputMode='decimal'; }
    if(input instanceof HTMLSelectElement) for(const [value,text] of definition.choices??[]) { const option=el('option',text) as HTMLOptionElement;option.value=value;input.append(option); }
    label.append(input);if(definition.hint)label.append(el('small',definition.hint));grid.append(label);
  }target.append(grid);
}
for(const t of ANALYSIS_TEMPLATES) { const option=el('option',t.label) as HTMLOptionElement;option.value=t.id;field('tool').append(option); }
function visibility() {
  root.querySelectorAll<HTMLElement>('[data-label]').forEach(label=>{label.hidden=false;});
  const show=(key:string, visible:boolean)=>{const label=document.querySelector<HTMLElement>(`[data-label="${key}"]`);if(label)label.hidden=!visible;};
  const kind=field('demandKind').value;
  for(const key of ['referenceAdr','referenceOccupancy','adrIncrease','occupancyDecreasePp','validMinAdr','validMaxAdr'])show(key,kind==='linear-sensitivity');
  show('points',kind==='scenario-points');show('history',kind==='historical');
  root.querySelector<HTMLElement>('[data-group="operating"]')!.hidden=template.depth==='pricing';
  root.querySelector<HTMLElement>('[data-group="investment"]')!.hidden=template.depth!=='investment';
  const method=field('terminalMethod').value;
  for(const key of ['exitCapRate','noiGrowth','sellingCostRate'])show(key,method==='exit-cap');show('terminalGrowth',method==='gordon');show('terminalAmount',method==='explicit');show('terminalDebtBalance',field('cashFlowMode').value==='equity'&&['exit-cap','explicit'].includes(method));
  const optimization=template.family!=='simulation' && template.id!=='max-revpar';
  show('adr',template.id!=='max-revpar');show('alternativeAdr',['what-if','ab'].includes(template.id));show('scenarioRows',template.id==='scenarios');
  for(const key of ['sensitivityPath','sensitivityValues'])show(key,template.id==='sensitivity');
  for(const key of ['stressAdr','stressOccupancy','stressOpex','stressDiscount'])show(key,template.id==='stress');
  show('optionMode',optimization);
  for(const key of ['priceStep','riskScore','serviceQuality'])show(key,optimization && field('optionMode').value==='grid');
  show('optionRows',optimization && field('optionMode').value==='manual');
  for(const key of ['qualityMin','noiMin'])show(key,optimization);
  for(const key of ['dscrMin','capexMax'])show(key,optimization && template.depth==='investment');
}
function readCase(): { input:FinancialCase; errors:string[] } {
  const errors:string[]=[];
  const numeric=(key:string,percent=false):number|undefined=> { try { const value=parseNumericInput(field(key).value); return percent && value!==undefined?percentageToRatio(value):value; }catch{errors.push(`${document.querySelector(`[data-label="${key}"] span`)?.textContent ?? key}: geçerli ${percent?'0–100 yüzde':'sayı'} girin.`);return undefined;} };
  const rate=(key:string):number|undefined=>{try{const n=parseNumericInput(field(key).value);return n===undefined?undefined:n/100;}catch{errors.push(`${key}: geçerli yüzde oranı girin.`);return undefined;}};
  const list=(key:string)=> { try{return field(key).value.trim()?field(key).value.split(';').map(value=>{const number=parseNumericInput(value);if(number===undefined)throw Error();return number;}):undefined;}catch{errors.push(`${key}: ; ile ayrılmış yıllık sayılar gerekli.`);return undefined;} };
  const caseData:Record<string,unknown>={schemaVersion:'case.v1',id:caseId,revision:state.revision,name:field('name').value,currency:field('currency').value,period:{start:field('start').value,end:field('end').value},minAdr:numeric('minAdr'),maxAdr:numeric('maxAdr'),minOccupancy:numeric('minOccupancy',true)};
  const kind=field('demandKind').value;
  if(kind==='linear-sensitivity') { caseData.referenceAdr=numeric('referenceAdr');caseData.referenceOccupancy=numeric('referenceOccupancy',true);caseData.demand={kind,modelVersion:'demand.v1',adrIncrease:numeric('adrIncrease'),occupancyDecreasePp:numeric('occupancyDecreasePp'),validMinAdr:numeric('validMinAdr'),validMaxAdr:numeric('validMaxAdr')}; }
  else { try {
    if(kind==='scenario-points') { const points=field('points').value.trim()?field('points').value.trim().split('\n').map((line,index)=>{const c=line.split(';');if(c.length!==2)throw Error(`Nokta ${index+1}: fiyat; doluluk yüzdesi gerekli.`); const p=parseNumericInput(c[0]),q=parseNumericInput(c[1]);if(p===undefined||q===undefined)throw Error('Boş nokta.');return {adr:p,occupancy:percentageToRatio(q)};}):undefined;caseData.demand={kind,modelVersion:'demand.v1',points}; }
    else { const rows=field('history').value.trim().split('\n').map(line=>{const c=line.split(';');if(c.length!==5)throw Error('Tarihsel satırda beş alan gerekli.');const p=parseNumericInput(c[0]),q=parseNumericInput(c[1]);if(p===undefined||q===undefined)throw Error('Fiyat/doluluk gerekli.');return {adr:p,occupancy:percentageToRatio(q),season:c[2],channel:c[3],segment:c[4]};});const fit=unwrap(fitHistoricalDemand(rows));Object.assign(caseData,{referenceAdr:fit.referenceAdr,referenceOccupancy:fit.referenceOccupancy,demand:fit.demand,assumptionNotes:fit.warning}); }
  }catch(error){errors.push(error instanceof Error?error.message:'Talep noktaları geçersiz.');} }
  const data:Record<string,unknown>={case:caseData};
  if(template.depth!=='pricing') {
    data.capacity={roomCount:numeric('roomCount'),openDays:numeric('openDays'),unavailableRoomNights:numeric('unavailableRoomNights'),unavailableReason:field('unavailableReason').value};
    data.costs=Object.fromEntries(['fixedOpex','variablePerOccupiedRoomNight','variableRevenueRate','managementFeeRate','propertyExpenses','nonOperatingIncome','replacementReserveRate'].map(key=>[key,/Rate$/.test(key)?numeric(key,true):numeric(key)]));
    try{data.otherRevenues=field('revenues').value.trim()?field('revenues').value.trim().split('\n').map(line=>{const c=line.split(';');if(c.length!==3)throw Error('Gelir satırında isim; sabit tutar; oda gecesi başına tutar gerekli.');const fixed=parseNumericInput(c[1]),per=parseNumericInput(c[2]);if(fixed===undefined||per===undefined)throw Error('Gelir tutarları gerekli.');return {name:c[0].trim(),fixedAnnual:fixed,perOccupiedRoomNight:per};}):[];}catch(error){errors.push(error instanceof Error?error.message:'Gelirler geçersiz.');}
  }
  if(template.depth==='investment') {
    const method=field('terminalMethod').value;
    const terminal=method==='exit-cap'?{method,exitCapRate:rate('exitCapRate'),noiGrowth:rate('noiGrowth'),sellingCostRate:numeric('sellingCostRate',true)}:method==='gordon'?{method,growth:rate('terminalGrowth')}:method==='explicit'?{method,amount:numeric('terminalAmount')}:{method};
    data.finance={forecastHorizon:numeric('forecastHorizon'),discountRate:rate('discountRate'),capRate:rate('capRate'),revenueGrowth:rate('revenueGrowth'),costGrowth:rate('costGrowth'),taxRate:numeric('taxRate',true),cashFlowMode:field('cashFlowMode').value,initialInvestment:numeric('initialInvestment'),annualCapex:list('annualCapex'),workingCapitalChanges:list('workingCapitalChanges'),annualDebtService:list('annualDebtService'),terminal,...(field('cashFlowMode').value==='equity'&&['exit-cap','explicit'].includes(method)?{terminalDebtBalance:numeric('terminalDebtBalance')}:{} )};
  }
  return {input:data as unknown as FinancialCase,errors};
}
function invalidate() {state=invalidateWizard(state);output=undefined;part('results').hidden=true;part('review').hidden=true;visibility();check();}
function check() {
  const {input,errors}=readCase();const ready=readinessForTemplate(template,input);
  part('readiness').textContent=errors.length?'Geçersiz giriş':ready.status==='READY'?'Veri hazır — varsayımları gözden geçirebilirsin.':ready.status==='INCOMPLETE'?'Eksik bilgiler var.':'Veri düzeltmesi gerekli.';
  messages(part('errors'),[...errors,...ready.missingFields.map(f=>f.reason),...ready.issues.map(i=>i.message)]);
  messages(part('warnings'),ready.warnings.map(w=>w.message));
  action('review').disabled=errors.length>0||ready.status!=='READY'||!state.approved;
  const missingOnly=document.querySelector<HTMLInputElement>('[data-action="missing-only"]')!.checked;
  if(missingOnly) {
    const paths:Record<string,string>={name:'name',currency:'currency',start:'period.start',end:'period.end',demandKind:'demand',referenceAdr:'referenceAdr',referenceOccupancy:'referenceOccupancy',minAdr:'minAdr',maxAdr:'maxAdr',minOccupancy:'minOccupancy',adrIncrease:'demand.adrIncrease',occupancyDecreasePp:'demand.occupancyDecreasePp',validMinAdr:'demand.validMinAdr',validMaxAdr:'demand.validMaxAdr',points:'demand.points',history:'demand',roomCount:'capacity.roomCount',openDays:'capacity.openDays',unavailableRoomNights:'capacity.unavailableRoomNights',unavailableReason:'capacity.unavailableReason',revenues:'otherRevenues'};
    const needed=new Set([...ready.missingFields.map(f=>f.path.replace(/^case\./,'')),...ready.issues.map(i=>i.path.replace(/^case\./,''))]);
    for(const group of ['case','pricing','operating','investment'])for(const definition of definitions[group]) {
      const label=document.querySelector<HTMLElement>(`[data-label="${definition.key}"]`)!;if(label.hidden)continue;
      const path=paths[definition.key]??`${group==='operating'?'costs':'finance'}.${definition.key}`;
      const invalid=errors.length>0||[...needed].some(required=>required===path||required.startsWith(`${path}.`)||path.startsWith(`${required}.`));
      label.hidden=!invalid;
    }
  }
}
function showTool() {
  template=findAnalysisTemplate(field('tool').value)??ANALYSIS_TEMPLATES[0];state=selectWizardTool(state,template);
  part('tool-description').replaceChildren(el('p',template.description),el('p',`Ne zaman? ${template.whenToUse}`),el('p',`Dikkat: ${template.tradeOff}`),el('p',`Gerekli veri: ${template.depth==='pricing'?'Case, fiyat sınırları ve talep modeli':template.depth==='operating'?'Case, talep, kapasite, gelir ve giderler':'İşletme verileri, yıllık nakit akışı ve değerleme varsayımları'}.`));
  part('inputs').hidden=true;part('review').hidden=true;part('results').hidden=true;output=undefined;action('approve').disabled=false;visibility();
}
function numericRequired(key:string):number {const value=parseNumericInput(field(key).value);if(value===undefined)throw Error(`${key}: değer gerekli.`);return value;}
function controls(input:FinancialCase):AnalysisControls {
  if(template.id==='max-revpar')return {adr:input.case.minAdr!};
  const adr=numericRequired('adr');const result:{-readonly [K in keyof AnalysisControls]?:AnalysisControls[K]}={adr};
  if(['what-if','ab'].includes(template.id))result.alternativeAdr=numericRequired('alternativeAdr');
  if(template.id==='sensitivity') {const path=field('sensitivityPath').value;const values=field('sensitivityValues').value.split(';').map(value=>{const n=parseNumericInput(value);if(n===undefined)throw Error('Duyarlılık değeri gerekli.');return /Rate$/.test(path)?n/100:n;});result.sensitivity={path,values};}
  if(template.id==='stress')result.stress={adrChange:numericRequired('stressAdr')/100,occupancyDropPp:numericRequired('stressOccupancy'),opexChange:numericRequired('stressOpex')/100,discountIncreasePp:numericRequired('stressDiscount')};
  if(template.id==='scenarios') {const base:ScenarioRequest={name:'Baz',financialCase:input,adr,depth:'investment'};result.scenarios=field('scenarioRows').value.trim().split('\n').map(line=>{const c=line.split(';');if(c.length!==5)throw Error('Senaryoda beş alan gerekli.');const nums=c.slice(1).map(value=>{const n=parseNumericInput(value);if(n===undefined)throw Error('Senaryo değerleri gerekli.');return n;});const targetOccupancy=percentageToRatio(nums[1]);const occupancyPatches=input.case.demand?.kind==='scenario-points'?input.case.demand.points.map((point,index)=>({path:`financialCase.case.demand.points.${index}.occupancy`,value:point.occupancy+targetOccupancy-unwrap(unwrap(compileDemand(input.case)).occupancyAt(adr))})):[{path:'financialCase.case.referenceOccupancy',value:targetOccupancy}];return unwrap(applyScenarioPatches(base,[{path:'adr',value:nums[0]},...occupancyPatches,{path:'financialCase.costs.fixedOpex',value:input.costs.fixedOpex*(1+nums[2]/100)},{path:'financialCase.finance.discountRate',value:nums[3]/100}],c[0]));});}
  if(template.family!=='simulation') {
    if(field('optionMode').value==='grid')result.options=unwrap(createPriceOptions(input.case.minAdr!,input.case.maxAdr!,numericRequired('priceStep'),percentageToRatio(numericRequired('riskScore')),percentageToRatio(numericRequired('serviceQuality'))));
    else result.options=field('optionRows').value.trim().split('\n').map(line=>{const c=line.split(';');if(c.length!==6)throw Error('Karar seçeneğinde altı alan gerekli.');const nums=c.slice(1).map(value=>{const n=parseNumericInput(value);if(n===undefined)throw Error('Seçenek değeri gerekli.');return n;});const patches=[{path:'adr',value:nums[0]},{path:'financialCase.costs.fixedOpex',value:nums[1]}];if(template.depth==='investment')patches.push({path:'financialCase.finance.initialInvestment',value:nums[2]});return {name:c[0],patches,riskScore:percentageToRatio(nums[3]),serviceQuality:percentageToRatio(nums[4])} satisfies DecisionOption;});
    const constraints:MetricConstraint[]=[];
    for(const [key,metric,operator] of [['qualityMin','serviceQuality','>='],['noiMin','noi','>='],...(template.depth==='investment'?[['dscrMin','dscr','>='],['capexMax','capex','<=']]:[])] as [string,string,'>='|'<=' ][]) {const n=parseNumericInput(field(key).value);if(n!==undefined)constraints.push({metric,operator,value:key==='qualityMin'?percentageToRatio(n):n});}
    result.constraints=constraints;
  }
  return result as AnalysisControls;
}
const metricNames:Record<string,string>={name:'Alternatif',parameter:'Değişen girdi',adr:'ADR',occupancy:'Doluluk',revpar:'RevPAR',roomRevenue:'Oda geliri',totalRevenue:'Toplam gelir',opex:'OPEX',gop:'GOP',ebitda:'EBITDA',noi:'NOI',npv:'NPV',value:'DCF değeri',directCapitalizationValue:'Doğrudan kapitalizasyon değeri',irr:'IRR',payback:'Geri ödeme (yıl)',dscr:'DSCR',risk:'Risk endeksi',serviceQuality:'Hizmet puanı',capex:'Yatırım + CapEx',feasible:'Kısıt durumu'};
const fmt=(metric:string,value:string|number|null|undefined)=>value==null?'—':typeof value==='string'?value:['occupancy','irr','risk','serviceQuality'].includes(metric)?`%${(value*100).toLocaleString('tr-TR',{maximumFractionDigits:2})}`:value.toLocaleString('tr-TR',{maximumFractionDigits:2});
function table(rows:readonly Readonly<Record<string,string|number|null>>[],keys:readonly string[]) {
  const wrap=el('div');wrap.className='table-wrap';const table=el('table');const head=el('thead'),tr=el('tr');for(const key of keys)tr.append(el('th',metricNames[key]??key));head.append(tr);table.append(head);const body=el('tbody');
  for(const row of rows){const line=el('tr');for(const key of keys)line.append(el('td',fmt(key,row[key])));body.append(line);}table.append(body);wrap.append(table);return wrap;
}
function plot(rows:AnalysisOutput['rows'],metric:string) {
  const numeric=rows.filter(row=>typeof row[metric]==='number');if(!numeric.length)return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('chart');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${metricNames[metric]??metric} alternatif karşılaştırması`);
  const draw=()=>{const width=Math.max(280,svg.getBoundingClientRect().width||600);svg.setAttribute('viewBox',`0 0 ${width} 240`);svg.replaceChildren();
    const values=numeric.map(row=>row[metric] as number);const min=Math.min(0,...values),max=Math.max(0,...values);const range=max-min||1;
    const node=(tag:string,attrs:Record<string,string|number>,text?:string)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,v] of Object.entries(attrs))n.setAttribute(key,String(v));if(text)n.textContent=text;return n;};
    svg.append(node('title',{},metricNames[metric]??metric));const sample=numeric.length>12?numeric.filter((_,i)=>i%Math.ceil(numeric.length/12)===0):numeric;
    const left=70,right=width-15,top=18,bottom=175;const y=(v:number)=>bottom-(v-min)/range*(bottom-top);
    svg.append(node('line',{x1:left,x2:right,y1:y(0),y2:y(0),stroke:'var(--line)'}));
    for(let i=0;i<3;i++){const v=min+range*i/2;svg.append(node('text',{x:left-7,y:y(v)+4,'text-anchor':'end'},fmt(metric,v)));}
    sample.forEach((row,i)=>{const step=(right-left)/sample.length;const x=left+step*i;const value=row[metric] as number;svg.append(node('rect',{x:x+step*.15,y:Math.min(y(0),y(value)),width:step*.7,height:Math.max(1,Math.abs(y(value)-y(0))),fill:'var(--accent)'}));const label=String(row.name??i+1);svg.append(node('text',{x:x+step/2,y:200,'text-anchor':'middle'},sample.length<=4?label.slice(0,16):String(i+1)));});
    svg.append(node('text',{x:(left+right)/2,y:229,'text-anchor':'middle'},`${metricNames[metric]??metric} · ${['occupancy','risk'].includes(metric)?'%':field('currency').value}`));
  };part('plots').append(svg);draw();if(typeof ResizeObserver!=='undefined')new ResizeObserver(draw).observe(svg);
}
function pricePlots(solution:Extract<RevparSolution,{status:'OPTIMAL'}>) {
  const simulation=simulatePrice(solution.inputSnapshot.caseSnapshot,solution.optimalAdr);
  if(!simulation.curve?.length)return;
  const curve=simulation.curve;
  for(const metric of ['occupancy','revpar'] as const) {
    const heading=el('h3',metric==='occupancy'?'Fiyat → doluluk':'Fiyat → RevPAR');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('chart');svg.dataset.priceChart=metric;svg.setAttribute('role','img');svg.setAttribute('aria-label',`${metricNames[metric]} ve seçilen optimum fiyat`);
    const draw=()=>{
      const width=Math.max(280,svg.getBoundingClientRect().width||600);svg.setAttribute('viewBox',`0 0 ${width} 240`);svg.replaceChildren();
      const node=(tag:string,attrs:Record<string,string|number>,text?:string)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,String(value));if(text)n.textContent=text;return n;};
      const factor=metric==='occupancy'?100:1;const values=curve.map(point=>point[metric]*factor);const min=Math.min(...values),max=Math.max(...values);const padding=Math.max((max-min)*.15,1e-4);const low=Math.max(0,min-padding),high=max+padding;
      const left=75,right=width-25,top=15,bottom=180;const pMin=curve[0].adr,pMax=curve.at(-1)!.adr;
      const x=(p:number)=>pMin===pMax?(left+right)/2:left+(p-pMin)/(pMax-pMin)*(right-left);const y=(v:number)=>bottom-(v-low)/(high-low)*(bottom-top);
      svg.append(node('title',{},metricNames[metric]));
      for(let i=0;i<3;i++){const v=low+(high-low)*i/2;svg.append(node('line',{x1:left,x2:right,y1:y(v),y2:y(v),stroke:'var(--line)'}));svg.append(node('text',{x:left-8,y:y(v)+4,'text-anchor':'end'},v.toLocaleString('tr-TR',{maximumFractionDigits:2})));if(pMin!==pMax||i===0){const p=pMin+(pMax-pMin)*i/2;svg.append(node('text',{x:x(p),y:bottom+22,'text-anchor':i===0?'start':i===2?'end':'middle'},p.toLocaleString('tr-TR',{maximumFractionDigits:2})));}}
      svg.append(node('path',{d:curve.map((point,i)=>`${i?'L':'M'}${x(point.adr)},${y(point[metric]*factor)}`).join(' '),fill:'none',stroke:'var(--accent)','stroke-width':2}));
      const q=metric==='occupancy'?solution.expectedOccupancy*100:solution.maximumRevpar;
      const point=node('circle',{cx:x(solution.optimalAdr),cy:y(q),r:6,fill:'var(--accent)'});point.append(node('title',{},`${solution.optimalAdr} ADR → ${q} ${metric==='occupancy'?'%':field('currency').value}`));svg.append(point);
      svg.append(node('text',{x:(left+right)/2,y:230,'text-anchor':'middle'},`ADR (${field('currency').value}) · ${metricNames[metric]} (${metric==='occupancy'?'%':field('currency').value})`));
    };
    part('plots').append(heading,svg);draw();if(typeof ResizeObserver!=='undefined')new ResizeObserver(draw).observe(svg);
  }
}
function showResult(result:AnalysisOutput) {
  output=result;part('results').hidden=false;part('result-title').textContent=result.title;messages(part('messages'),result.messages);
  part('metrics').replaceChildren();const first=result.rows[0];for(const key of template.depth==='pricing'?['adr','occupancy','revpar']:template.depth==='investment'?['noi','npv','value']:['totalRevenue','opex','noi'])if(first&&typeof first[key]==='number'){const card=el('div');card.className='stat';card.append(el('span',metricNames[key]));card.append(el('strong',fmt(key,first[key])));part('metrics').append(card);}
  const columns=['name','parameter','adr','occupancy','revpar',...(template.depth!=='pricing'?['totalRevenue','opex','gop','ebitda','noi']:[]),...(template.depth==='investment'?['npv','value','directCapitalizationValue','irr','payback','dscr','capex']:[]),...(template.family==='multi-objective'||template.family==='minimization'?['risk','serviceQuality']:[]),'feasible'];
  part('result-table').replaceChildren(table(result.rows,columns.filter(key=>result.rows.some(row=>Object.hasOwn(row,key)))));
  part('plots').replaceChildren();if(result.rows.length>1){plot(result.rows,template.depth==='pricing'?'revpar':template.depth==='investment'?'npv':'noi');}
  const exact=(result.raw as {solution?:RevparSolution}).solution;
  if(exact?.status==='OPTIMAL')pricePlots(exact);
  part('forecast').replaceChildren();
  const raw=result.raw as { best?:{scenario?:{calculation?:{annual?:readonly {year:number;cashFlow:number;dscr:number|null;operating:{noi:number}}[]}}} };
  const annual=raw.best?.scenario?.calculation?.annual;if(annual)part('forecast').append(el('h3','Seçilen yatırımın yıllık nakit akışı'),table(annual.map(year=>({name:`Yıl ${year.year}`,noi:year.operating.noi,cashFlow:year.cashFlow,dscr:year.dscr})),['name','noi','cashFlow','dscr']));
  if(template.depth==='investment')part('messages').append(el('p','IRR “—” ise nakit akışı köksüz, çok işaret değişimli veya arama aralığı dışındadır; durum hesaplama izinde belirtilir. Geri ödeme “—” ise işletme akışlarıyla tahmin ufkunda geri ödeme gerçekleşmez. DSCR borç servisi olmayan yılda tanımsızdır.'));
  part('trace').textContent=JSON.stringify(result.raw,null,2);state=completeWizard(state);
}
function download(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
action('approve').addEventListener('click',()=>{state=approveWizardTool(state);part('inputs').hidden=false;action('approve').disabled=true;visibility();check();});
action('example').addEventListener('click',()=>{hydrate(example);state=invalidateWizard(state);part('notice').textContent='Örnek varsayımlar yüklendi. Bunlar piyasa verisi değildir; kendi verilerinle değiştirebilirsin. Tüm girdileri düzenlemek için “yalnız eksik alanlar” seçimini kaldır.';if(state.approved)invalidate();else visibility();});
document.querySelector<HTMLInputElement>('[data-action="missing-only"]')!.addEventListener('change',()=>{visibility();check();});
field('tool').addEventListener('change',showTool);
field('intent').addEventListener('input',()=>{const recommendations=recommendAnalysis(field('intent').value);part('recommendations').replaceChildren(el('p',`Önerilen araçlar: ${recommendations.map(t=>t.label).join(', ')}`));});
root.addEventListener('input',event=>{if((event.target as HTMLElement).dataset.field && !['tool','intent'].includes((event.target as HTMLElement).dataset.field!))invalidate();});
action('review').addEventListener('click',()=>{try{const {input,errors}=readCase();const ready=readinessForTemplate(template,input);if(errors.length||ready.status!=='READY')throw Error('Eksik veya geçersiz verileri düzeltin.');const settings=controls(input);state=reviewWizard(state,true);
  messages(part('summary'),[template.description,`${input.case.name} · ${input.case.currency} · ${input.case.period?.start}–${input.case.period?.end}`,`ADR aralığı ${input.case.minAdr}–${input.case.maxAdr}; talep modeli ${input.case.demand?.kind}; minimum doluluk ${input.case.minOccupancy===undefined?'belirtilmedi':fmt('occupancy',input.case.minOccupancy)}.`,input.finance?`Nakit akışı bazı ${input.finance.cashFlowMode}; ufuk ${input.finance.forecastHorizon} yıl; iskonto ${input.finance.discountRate*100}%; terminal yöntemi ${input.finance.terminal.method}.`:'',settings.options?`${settings.options.length} karar seçeneği değerlendirilecek.`:'',template.tradeOff]);part('review').hidden=false;
}catch(error){messages(part('errors'),[error instanceof Error?error.message:'Varsayımlar geçersiz.']);}});
action('run').addEventListener('click',()=>{try{if(state.phase!=='REVIEW')throw Error('Önce varsayımları gözden geçirin.');const {input,errors}=readCase();if(errors.length)throw Error(errors.join(' '));const result=runAnalysis(template,input,controls(input));if(!result.success)throw Error(result.issues.map(issue=>issue.message).join(' '));showResult(result.value);}catch(error){messages(part('errors'),[error instanceof Error?error.message:'Hesaplama hatası.']);part('results').hidden=true;}});
action('save').addEventListener('click',()=>{try{localStorage.setItem(storageKey,JSON.stringify({version:'workbench-form.v1',id:caseId,revision:state.revision,fields:fields()}));part('notice').textContent='Taslak bu tarayıcıda kaydedildi; yeniden açıldığında hazır olma durumu tekrar kontrol edilir.';}catch{part('notice').textContent='Tarayıcı yerel saklamaya izin vermedi; Case dosyası indirebilirsin.';}});
action('export').addEventListener('click',()=>{try{const {input,errors}=readCase();if(errors.length)throw Error(errors.join(' '));const text=unwrap(serializeCaseDocument({...input,formValues:fields()}));download('hotel-case.json',text);}catch(error){part('notice').textContent=error instanceof Error?error.message:'Case indirilemedi.';}});
document.querySelector<HTMLInputElement>('[data-action="import"]')!.addEventListener('change',async event=>{try{const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;const data=unwrap(parseCaseDocument(await file.text()));const payload=data.payload as {case?:{id:string;revision:number};formValues?:Record<string,string>};if(!payload.formValues)throw Error('Bu ekran için formValues içeren dışa aktarılmış Case dosyasını kullanın.');hydrate(payload.formValues);if(payload.case){caseId=payload.case.id;state={...state,revision:payload.case.revision};}showTool();part('notice').textContent='Case yüklendi; analiz aracını onaylayıp verileri kontrol edin.';}catch(error){part('notice').textContent=error instanceof Error?error.message:'Case yüklenemedi.';}});
action('download-result').addEventListener('click',()=>{if(output)download('hotel-analysis-result.json',JSON.stringify(output,null,2));});
try{const saved=JSON.parse(localStorage.getItem(storageKey)??'null');if(saved?.version==='workbench-form.v1'&&typeof saved.fields==='object'&&saved.fields){hydrate(saved.fields);if(typeof saved.id==='string'&&saved.id.trim())caseId=saved.id;if(Number.isSafeInteger(saved.revision)&&saved.revision>=0)state={...state,revision:saved.revision};part('notice').textContent='Kaydedilmiş taslak yüklendi; hesaplama öncesi veriler yeniden doğrulanacak.';}}catch{/* Start with empty user inputs. */}
showTool();
