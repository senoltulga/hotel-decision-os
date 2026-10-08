# HDSE uygulama ve kapsam denetimi

Tarih: 7 Ekim 2026. Kaynak: Master Blueprint v1.0, MAX RevPAR uygulama sözleşmesi ve kullanıcının tüm modülleri yazma talimatı.

## Çalışan kapsam

| İstenen modül | Uygulama kanıtı | Doğrulama kanıtı |
|---|---|---|
| Case, taslak/analiz ayrımı, birimler | case.types.ts, case.schema.ts, numerical-policy.ts | t01.test.ts |
| Değişken sınıfları ve problem rolleri | variable.types.ts | t01.test.ts; finans/optimizasyon testleri |
| RevPAR ve talep kuralları | revpar.skill.ts, demand.skill.ts | t02.test.ts |
| Kısıtlar ve readiness | constraint.validator.ts, readiness.engine.ts | t03.test.ts |
| Eksik veri açıklaması ve yalnız eksik alanların istenmesi | readiness, workbench missing-only görünümü | workbench.test.ts |
| Problem oluşturucu ve sabit snapshot | max-revpar.builder.ts, problem.schema.ts | t04.test.ts |
| MAX RevPAR | max-revpar.solver.ts | t05.test.ts; analitik bağımsız örnekler |
| Sonuç, baz farkı, varsayımlar, yuvarlama riski | result.explainer.ts | t05.test.ts; workbench.test.ts |
| Guided wizard: açıklama, araç onayı, readiness, özet onayı | decision.guide.ts, workbench.ui.ts | analysis.test.ts; bütün 16 araç için workbench.test.ts |
| Kapasite, ADR, oda/diğer/toplam gelir | financial.skills.ts | finance.test.ts |
| OPEX, GOP, EBITDA, NOI | financial.skills.ts; FINANCIAL_MODEL_CONTRACT.md | finance.test.ts bağımsız P&L örneği |
| Cash flow, DSCR ve borç bazı | financial.skills.ts, financial.engine.ts | finance.test.ts |
| Direct cap, terminal, DCF, NPV | valuation.skills.ts, financial.engine.ts | finance.test.ts |
| IRR, geri ödeme, iskontolu geri ödeme | valuation.skills.ts | finance.test.ts; Microsoft bağımsız IRR örneği |
| What-if, A/B | scenario.engine.ts | analysis.test.ts; workbench.test.ts |
| Senaryo, duyarlılık, stres | scenario.engine.ts | analysis.test.ts; doğrusal ve nokta modelleriyle workbench.test.ts |
| MAX NOI, MAX NPV, MAX değer | optimization.engine.ts, analysis.templates.ts | analysis.test.ts; workbench.test.ts |
| MIN OPEX, MIN CapEx, MIN risk, MIN geri ödeme | optimization.engine.ts | analysis.test.ts; workbench.test.ts |
| RevPAR/doluluk, NOI/OPEX, NPV/risk/CapEx Pareto | optimization.engine.ts | Pareto baskınlık testi; workbench.test.ts |
| Senaryo/problem şablonları ve skill graph bildirimi | analysis.templates.ts; 16 kayıt | analysis.test.ts |
| Tarihsel talep uyumu | historical-demand.skill.ts | analysis.test.ts; workbench.test.ts |
| Rehber ve opsiyonel AI sınırı | decision.guide.ts; ai-assistant.adapter.ts | assistant.test.ts |
| Case yerel taslak saklama, dışa aktarım/geri yükleme | case.repository.ts; workbench.ui.ts | analysis.test.ts; workbench.test.ts |
| Model yaşam döngüsü | model.lifecycle.ts | lifecycle.test.ts |
| Lokal uygulama ve paketleme | build-workbench.ts; serve.ts; dist/index.html | typecheck; tüm UI etkileşimleri; HTTP yanıtı ve dosya SHA-256 karşılaştırması |

## Task numaraları

Önceki T01–T04 teslimleri uygulama sözleşmesinin iş sırasına göre adlandırılmıştır; orijinal blueprint numaralarıyla birebir aynı değildir. Orijinal blueprint task eşlemesi:

| Blueprint task | Teslim |
|---|---|
| T01 Case Schema | artifacts/T01 |
| T02 Variable Taxonomy | artifacts/T01 ve variable.types.ts |
| T03 RevPAR | artifacts/T02 |
| T04 Demand | artifacts/T02 |
| T05 Constraints | artifacts/T03 |
| T06 Readiness | artifacts/T03 |
| T07 Wizard | artifacts/T07 |
| T08 Problem Builder | artifacts/T04 |
| T09 Solver | artifacts/T05 |
| T10 Result Layer | artifacts/T06 |
| T11 End-to-End | artifacts/T08 ve validation/test-results.tap |
| T12 Validation / Lock | artifacts/T12; model.lifecycle.ts; release/flow-baseline.json |

Ek finans/simülasyon/optimizasyon modülleri artifacts/T09–T11'de kayıtlıdır. Artifact kayıtları task bazında örnekler ve ortak gerçek test kanıtını içerir.

## Kabul senaryoları

Uygulama sözleşmesindeki A01–A07 analitik optimumlar t05.test.ts'de; A08–A15 veri, model ve aralık hataları t01/t02/t03 testlerinde; A16 deterministik tekrar t02/t04/t05'te; A17 eski sonuç t03-ui/workbench'te; A18 yuvarlanmış fiyatın kısıt ihlali t05.test.ts'de doğrulanır.

## Açık sınırlar

- MAX RevPAR sürekli fiyat aralığında analitik çözümdür. Diğer optimizasyonlar açık sonlu seçenekler için tam karşılaştırmadır; sürekli uzay çözümü iddiası yoktur.
- Risk ve kalite puanları kullanıcı girdisidir. Olasılıksal talep/riske yönelik stokastik model bu blueprint'in deterministik sürümüne dahil değildir.
- Finansal sözleşme basitleştirilmiş, açık bir modeldir. Vergi mevzuatı ve USALI sertifikasyonu yapılmadı. Finans köprüsü bağımsız uzman kabulünden önce kalıcı LOCK olarak etiketlenmez.
- IRR çok işaret değişimli nakit akışlarında keyfi bir kök seçmez; durum raporlar.
- Opsiyonel AI adapter sağlayıcıdan bağımsızdır; varsayılan uygulama kural tabanlı rehberle çevrimdışı çalışır. API sağlayıcısı kurulmuş gibi gösterilmez.
- UI testleri gerçek paketlenmiş kodu JSDOM'da çalıştırır. Bilgisayar kullanım izinleri olmadığından gerçek tarayıcı ekran görüntüsü ve piksel/responsive görsel kabulü tamamlanmadı.
- Authentication, ekip paylaşımı, bulut veritabanı ve internet yayını talep edilen ilk modüller içinde değildir; uygulanmadı.

Bu sınırlar çalışma zamanı sonuçlarında ve finans sözleşmesinde açıkça belirtilir; eksik finansal veri veya piyasa varsayımı uydurulmaz.
