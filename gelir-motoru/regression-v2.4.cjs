// Gelir Motoru regresyon testi — model v2.4 (yerel dosya: node regression.cjs [file:///yol/index.html])
const {chromium}=require('playwright');
const FILE=process.argv[2]||'file://'+require('path').join(__dirname,'index.html');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const ctx=await b.newContext();await ctx.addInitScript(()=>{try{localStorage.setItem('gm_ws','0')}catch(e){}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(FILE);await pg.waitForTimeout(500);
const R=await pg.evaluate(()=>{const o=compute(2029),s=k=>sum(o[k]);const dc=dcfCalc(),tp=tpCalc();
 const snap=JSON.stringify(projSnap().data);DCF.disc=9;projApply(JSON.parse(JSON.stringify({...projSnap(),data:JSON.parse(snap)})));
 return{ver:MODEL_VERSION,pb:flows().p,T:scenarioFlow("T").p,G:scenarioFlow("G").p,inv:INV.buy+rtot()+INV.wc,reno:rtot(),gross3:s("gross"),gop3:s("gop"),noi3:s("noi"),net3:s("net"),
  npv:dc.npv,irr:dc.irr,disc:pbCalc("disc").p,lev:pbCalc("lev").p,tv:pbCalc("tv").p,tpP:tp.p,tpNet3:tp.yr[2].net,roundDisc:DCF.disc,tpl:TPL_LIST.map(x=>x[0]).join(),wiz:Object.keys(WIZ).join(),plbNet:PBc().net,plbToTP:(()=>{const n=Math.round(PBc().net),bak=TP;pbToTPx();const v=Math.round(tpStab(()=>{}).net);TP=bak;return [n,v]})(),prUSD:Math.round(prYearUSD())}});
const W=await pg.evaluate(()=>{GMWS.open();const o={};for(const m of['pay','pl','pr','dcf']){GMWS.show(m);o[m]=[document.querySelectorAll('#wsr .ws-k').length,document.querySelectorAll('#wsr .ws-card').length,document.querySelectorAll('#wsr .ws-cm').length,!!document.querySelector('#wsr .ws-warn')]}const a=document.querySelectorAll('#wsr .ws-cm .ws-ex').length;GMWS.close();return o});
const wsOk=m=>W[m][0]>=6&&W[m][1]>=4&&W[m][1]===W[m][2]&&!W[m][3];
const near=(a,v,t)=>Math.abs(a-v)<=t;
const T=[["Model sürümü",R.ver==="2.4"],["Baz geri dönüş 11,7 yıl",near(R.pb,11.68,.05)],["Temkinli 13,2",near(R.T,13.2,.1)],["Güçlü 10,6",near(R.G,10.6,.1)],
 ["Toplam yatırım 10.750.000",R.inv===10750000],["Renovasyon 2.500.000",R.reno===2500000],["3. yıl brüt 1.611.150",near(R.gross3,1611150,25)],["3. yıl GOP 1.005.659",near(R.gop3,1005659,25)],["3. yıl NOI 935.659",near(R.noi3,935659,25)],["3. yıl net 871.213",near(R.net3,871213,25)],
 ["DCF NPV (yer tutucu)",near(R.npv,-1787096,50)],["DCF IRR %9,6",near(R.irr,.096,.002)],["İskontolu geri dönüş yok",R.disc==null],["Özkaynak geri dönüş 15,5",near(R.lev,15.5,.1)],["Terminal dahil 1,6",near(R.tv,1.6,.1)],
 ["Şablon = ana model (net 3. yıl)",near(R.tpNet3,R.net3,30)],["Şablon geri dönüş 11,7",near(R.tpP,11.68,.05)],["Proje kaydet/aç döngüsü",R.roundDisc===12],
 ["Şablonlar: pay, val, turg, pr, plb",R.tpl==="pay,val,turg,pr,plb"],["Sihirbazlar: 7 adet",R.wiz==="target,dcf,imp,new,val,pr,plb"],
 ["P&L oluşturma örnek net 854.765",R.plbToTP[0]===854765],["P&L → Payback aktarımı aynı net",R.plbToTP[0]===R.plbToTP[1]],["Çalışma alanı: Payback modülü (gösterge, grafik, tablo, yorum)",wsOk("pay")],["Çalışma alanı: P&L modülü",wsOk("pl")],["Çalışma alanı: Personel modülü",wsOk("pr")],["Çalışma alanı: DCF modülü",wsOk("dcf")],["Personel modülü yıllık USD",R.prUSD>150000&&R.prUSD<300000]];
let bad=0;T.forEach(([n,ok])=>{console.log((ok?"OK   ":"HATA ")+n);if(!ok)bad++});
console.log(errs.length?"Sayfa hataları: "+errs.join("|"):"Sayfa hatası yok");
console.log(bad||errs.length?"BAŞARISIZ":"TÜM TESTLER GEÇTİ");await b.close();process.exit(bad||errs.length?1:0)})();
