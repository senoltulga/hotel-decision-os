# MAX RevPAR v1.0 — Uygulama Sözleşmesi

Tarih: 7 Ekim 2026  
Durum: DRAFT — geliştirmeye hazır; henüz VALIDATED veya LOCKED değil  
Kaynak: Hotel Decision Support Engine — Master Blueprint v1.0

## 1. Amaç ve kapsam

Kullanıcı bir otel Case'i oluşturur, MAX RevPAR analizini seçer, eksik bilgileri tamamlar ve açık talep varsayımları altında en yüksek RevPAR üreten ADR'yi görür.

v0.1 kapsamı: Case sözleşmesi, doğrulama, iki deterministik talep modeli, readiness, kısıtlar, problem oluşturucu, çözücü, yönlendirilmiş arayüz, sonuç açıklaması ve testler.

Sonraki sürümler: NOI, NPV, maliyet minimizasyonu, çok amaçlı optimizasyon, tarihsel veriden talep tahmini, AI önerileri, çoklu para birimi dönüşümü, kanal/sezon bazında fiyatlama, kimlik doğrulama ve ekip paylaşımı.

Bu sözleşme geliştirme için önerilen başlangıç davranışını tanımlar. Finansal doğruluk ve kullanıcı akışı doğrulanmadan kalıcı baseline sayılmaz.

## 2. Temel kararlar

- Doluluk içeride 0–1 oranı olarak saklanır; arayüzde yüzde gösterilir.
- ADR ve RevPAR aynı açık para birimini kullanır. MVP kur dönüşümü yapmaz.
- Analiz tek bir dönem içindir. Dönem içindeki sezonlar tek talep modeliyle temsil edilir; sonuç bu varsayımı açıklar.
- RevPAR optimizasyonunda oda sayısı zorunlu değildir. Oda geliri hesaplanacak sonraki modülde kapasite gerekecektir.
- Talep modeli hesaplama modülüdür; çözücü finansal formül üretmez.
- Eksik veri doldurulmaz, piyasa verisi uydurulmaz.
- v0.1 sürekli ADR aralığını optimize eder. Fiyat adımı veya tam kuruş kısıtı yoktur. Gösterilen yuvarlanmış fiyat uygulanacaksa yeniden hesaplama gerekir.
- Her talep modelinde optimum analitik adaylarla aranır; kaba grid taraması optimum kanıtı olarak kullanılmaz.
- Tekrarlanabilirlik girdiler, problem sürümü, model sürümü, çözücü sürümü ve sayısal politikaya bağlıdır.

## 3. Veri sözleşmesi

### Case

| Alan | Tip / birim | Kural |
|---|---|---|
| schemaVersion | sabit sürüm | `case.v1` |
| id | string | Sistem tarafından atanır; hesaplamayı etkilemez |
| revision | integer | Girdi değiştiğinde artar |
| name | string | Boş olamaz |
| currency | string | Uygulamanın doğruladığı para birimi kodu; tüm fiyatlarda aynı |
| period.start / end | tarih | Başlangıç bitişten sonra olamaz |
| referenceAdr | para/gece, opsiyonel | Sonlu ve > 0 |
| referenceOccupancy | oran, opsiyonel | Sonlu, 0–1 dahil |
| minAdr / maxAdr | para/gece | Sonlu, > 0; min ≤ max |
| minOccupancy | oran, opsiyonel | Sonlu, 0–1 dahil |
| demand | ayrımlı model | Aşağıdaki modellerden biri |
| assumptionNotes | string, opsiyonel | Kullanıcının veri kaynağı ve varsayım açıklaması |

Taslak Case eksik alan taşıyabilir. Çözücüye verilen doğrulanmış Problem eksik alan taşıyamaz. Şema doğrulaması, taslak kaydetme ile çalıştırılabilir problem üretmeyi ayırır.

Boş alan sıfır değildir. `null`, boş string ve eksik alan normalizasyon sonrasında eksik sayılır; `NaN`, sonsuz ve sayı olmayan girdiler geçersiz sayılır. Türkçe arayüzde ondalık virgül kontrollü şekilde dönüştürülür; belirsiz binlik/ondalık gösterimler reddedilir.

### Değişken rolü

Metrik tanımı ile problem rolü ayrıdır:

| Metrik | Hesaplama kaynağı | MAX RevPAR problemindeki rol |
|---|---|---|
| ADR | aday karar | decision |
| Doluluk | talep fonksiyonu | derived; ayrıca kısıtın konusu |
| RevPAR | ADR × doluluk | derived ve objective |
| Talep parametreleri | kullanıcı girdisi | fixed assumption |
| Minimum doluluk | kullanıcı girdisi | constraint parameter |

Bu yaklaşım bir metriği tek bir sınıfa zorlayarak türetilen hedefleri kaybetmeyi önler.

## 4. Talep modelleri

### 4.1 Doğrusal duyarlılık

Gerekli alanlar: referenceAdr, referenceOccupancy, adrIncrease, occupancyDecreasePp, validMinAdr, validMaxAdr.

- `adrIncrease > 0`: belirtilen fiyat artışı, aynı para biriminde.
- `occupancyDecreasePp ≥ 0`: bu artış için doluluk düşüşü, yüzde puanı.
- Referans ADR modelin geçerli aralığında olmalıdır.
- Optimizasyon aralığı modelin geçerli aralığı içinde olmalıdır.

Formül:

```text
k = (occupancyDecreasePp / 100) / adrIncrease
q(p) = referenceOccupancy - k × (p - referenceAdr)
RevPAR(p) = p × q(p)
```

Örnek: 5 USD artış → 2 yüzde puanı düşüş; k = 0.004 / USD.

Doluluk sessizce 0 veya 1'e kırpılmaz. Doğrusal modelin optimizasyon aralığının uçlarındaki doluluk 0–1 dışında ise model bu aralık için geçersizdir. Kullanıcı fiyat aralığını veya modeli düzeltir. k = 0 desteklenir.

### 4.2 Senaryo noktaları

Gerekli alanlar: en az iki farklı ADR içeren `{adr, occupancy}` noktası.

- ADR > 0, doluluk 0–1 dahil olmalıdır.
- Girdi noktaları ADR'ye göre sıralanır.
- Tekrarlanan ADR noktaları, aynı doluluğu taşısalar bile açık düzeltme istemek için reddedilir.
- ADR arttıkça doluluk artamaz; eşit doluluk kabul edilir. Bu MVP modeli uzman incelemesi gerektiren artan veya karmaşık eğrileri desteklemez.
- En düşük/en yüksek nokta modelin geçerli alanını belirler.
- Noktalar arasında doğrusal interpolasyon uygulanır.
- Model alanı dışında ekstrapolasyon yapılmaz; ADR sınırları sessizce daraltılmaz.
- Referans ADR ve doluluk optimizasyon için zorunlu değildir. Referans karşılaştırması istenirse ikisi birlikte gerekir.
- Kullanıcı referansı modelden farklıysa baz ölçüm ile model varsayımı ayrı gösterilir; referans model kalibrasyonu yapılmış gibi sunulmaz.

Her segment için:

```text
b = (q2 - q1) / (p2 - p1)
a = q1 - b × p1
q(p) = a + b × p
RevPAR(p) = a × p + b × p²
```

## 5. Doğrulama ve readiness

İşlem sırası: normalize → mevcut alanları doğrula → model bağımlılıklarını belirle → eksikleri bul → model alanını kontrol et → readiness.

Readiness çıktısı:

```text
status: READY | INCOMPLETE | BLOCKED
missingFields: [{ path, reason, inputKind }]
issues: [{ code, path, message, remediation }]
warnings: [{ code, message }]
```

- READY: gerekli girdiler mevcut, geçerli ve seçilen model aralığı yeterli.
- INCOMPLETE: kullanıcı tarafından tamamlanabilecek zorunlu alan eksik.
- BLOCKED: mevcut veri geçersiz, desteklenmeyen model seçilmiş veya talep modeli istenen fiyat alanını kapsamıyor.
- Geçersiz mevcut alan varsa BLOCKED önceliklidir; tüm eksikler yine döndürülür.
- Talep modeli yoksa INCOMPLETE: kullanıcı iki desteklenen modelden birini seçebilir.
- BLOCKED kalıcı bir hata değildir; düzeltme sonrası readiness tekrar çalışır.

Minimum doluluk şartının hiçbir fiyatla karşılanamaması readiness hatası değildir: veri READY olabilir, çözücü INFEASIBLE döndürür.

Standart hata kodları: REQUIRED_FIELD, INVALID_NUMBER, INVALID_ADR_RANGE, INVALID_OCCUPANCY, DUPLICATE_ADR_POINT, NON_MONOTONE_DEMAND, UNSUPPORTED_DEMAND_MODEL, OUTSIDE_DEMAND_DOMAIN, INVALID_PERIOD.

## 6. Problem oluşturucu

`buildMaxRevparProblem(case)` doğrulanmış readiness olmadan problem üretmez. UI kontrolü tek güvenlik sınırı değildir; domain katmanı da geçersiz çağrıyı reddeder.

Problem sabit ve değişmez bir snapshot taşır:

```text
problemVersion: max-revpar.v1
caseId, caseRevision
currency, period
objective: { metric: revpar, direction: max }
decision: { metric: adr, min, max }
demand: normalize edilmiş model + modelVersion
constraints: occupancy in [0, 1], optional minOccupancy
reference: optional paired ADR / occupancy
calculationVersion, solverVersion, numericalPolicyVersion
```

Problem çözücüye verildikten sonra Case değişiklikleri snapshot'ı değiştiremez.

## 7. Çözücü davranışı

Her model segmenti, ADR sınırları ve minimum doluluk kısıtıyla kesiştirilir. Boş kesişim atlanır.

Her geçerli segment için adaylar:

1. Uygulanabilir aralığın alt sınırı.
2. Uygulanabilir aralığın üst sınırı.
3. b < 0 ise `p* = -a / (2b)`; yalnızca uygulanabilir aralık içindeyse.

Segment noktaları aralık uçları üzerinden değerlendirilir. k = 0 veya b = 0 için uç adayları yeterlidir. minAdr = maxAdr geçerlidir; tek aday değerlendirilir.

Her adayda talep skill'i, constraint validator ve RevPAR skill'i çağrılır. En yüksek ham RevPAR seçilir. Sayısal politika içinde eşit sayılan hedeflerde daha düşük ADR seçilir; bu açık ve deterministik bir tercih kuralıdır.

Çözücü durumları:

- OPTIMAL: desteklenen model ve kısıtlar altında optimum bulundu.
- INFEASIBLE: veri geçerli, uygulanabilir fiyat yok.
- INVALID_PROBLEM: doğrulanmamış veya bozulmuş problem.
- NUMERICAL_ERROR: beklenmeyen sonlu olmayan hesaplama; başarı sonucu üretilemez.

### Sayısal politika

İlk uygulama IEEE-754 double kullanır. Toleranslar tek sürümlü dosyada tutulur; farklı modüller ayrı tolerans uydurmaz.

- Oran karşılaştırması mutlak toleransı: 1e-10.
- Fiyat/hedef karşılaştırması: `1e-10 × max(1, abs(x), abs(y))`.
- Kullanıcıya para gösterimi: 2 ondalık; doluluk: 2 ondalık yüzde.
- Optimum sıralaması gösterim için yuvarlanan sayılarla yapılmaz.
- Tolerans nedeniyle sınır kabulü varsa ham değerler saklanır; anlamlı kısıt ihlali gizlenmez.
- Ölçek ve sayısal kararlılık testlerinde bu başlangıç toleransları doğrulanır; LOCK öncesinde değişebilir.

## 8. Sonuç sözleşmesi

OPTIMAL sonucu şu bilgileri taşır:

```text
status
optimalAdr, expectedOccupancy, maximumRevpar
referenceMetrics: optional
delta: optional absolute and relative differences
bindingConstraints
usedAssumptions
warnings
candidateCount
inputSnapshot
versions
explanationFacts
```

Referans RevPAR sıfırsa göreli fark hesaplanmaz. Referans yoksa karşılaştırma gizlenir; varsayılan baz değer üretilmez.

Binding constraints yalnızca eşitlikte aktif olan sınırları içerir: min ADR, max ADR, minimum doluluk veya fiziksel doluluk sınırı. İç segment kırılma noktası kısıt olarak etiketlenmez.

Sayısal fonksiyonlar açıklama metni yazmaz; açıklama katmanı sonuç verilerinden Türkçe metin üretir. AI gerektirmez.

Zorunlu sonuç mesajı: “Bu sonuç, belirtilen talep modeli ve kısıtlar altında hesaplanan RevPAR optimumudur. Gerçekleşecek talebi garanti etmez; NOI veya kâr optimumu olarak yorumlanmamalıdır.”

Gösterilen 2 ondalıklı ADR ayrıca talep ve RevPAR fonksiyonlarından geçirilir; uygulama fiyatı ile ham optimum arasındaki fark veya kısıt ihlali gösterilir. Ham optimum gösterim yuvarlamasıyla değiştirilmez.

## 9. Kullanıcı akışı

1. Case oluştur: ad, dönem ve para birimi.
2. MAX RevPAR açıklaması: hedef, değiştirilebilir ADR, talep bağımlılığı ve kârla farkı.
3. Readiness çalıştır: mevcut geçerli girdileri yeniden sorma.
4. Eksik/yanlış verileri tamamla: talep modeli seçimi ve ilgili alanlar.
5. Varsayımları özetle: fiyat aralığı, talep eğrisi, doluluk kısıtı; “Hesapla” eylemiyle onay.
6. Domain seviyesinde readiness ve problem doğrulamasını tekrar çalıştır.
7. Çöz ve sonucu göster.
8. Girdi değiştiğinde önceki sonuç “Güncel değil” olur; yeni hesaplama gerekir.

Her sayfada ayrı onay zorunlu değildir. Kullanıcı onayı, modelin anlamını gördükten sonraki hesaplama eyleminde toplanır.

Sonuç ekranı: ADR, doluluk, RevPAR, varsa baz farkı, talep/RevPAR grafikleri, bağlayıcı kısıtlar, varsayımlar ve model sürümü. INFEASIBLE ekranı hangi kısıtın çözümü engellediğini ve hangi girdinin gözden geçirilebileceğini açıklar; optimum sayı göstermez.

## 10. Kabul testleri

| ID | Girdi / durum | Beklenen |
|---|---|---|
| A01 | 145 USD, %55; +5 USD → -2 yüzde puanı; aralık 130–150 | ADR 141.25, doluluk 0.565, RevPAR 79.80625 |
| A02 | A01 ve minimum doluluk %60 | ADR 132.5, doluluk 0.60, RevPAR 79.5; min doluluk aktif |
| A03 | A01 ve minimum doluluk %70 | READY → INFEASIBLE |
| A04 | Sabit doluluk %55, aralık 130–150 | ADR 150, RevPAR 82.5 |
| A05 | Tek fiyat 145, model doluluğu %55 | ADR 145, RevPAR 79.75 |
| A06 | Noktalar (130, .65), (145, .55), (150, .50); aralık 130–150 | ADR 130, doluluk .65, RevPAR 84.5 |
| A07 | Noktalar (100, .8), (200, .2) | ADR 116.6666667, doluluk .7, RevPAR yaklaşık 81.6666667 |
| A08 | Talep modeli eksik | INCOMPLETE; çözücü çalışmaz |
| A09 | Minimum ADR maksimumdan büyük | BLOCKED / INVALID_ADR_RANGE |
| A10 | Doluluk 1.1, NaN veya sonsuz | BLOCKED; alan bazında hata |
| A11 | Yinelenen ADR noktaları | BLOCKED / DUPLICATE_ADR_POINT |
| A12 | Model alanı 130–150; aralık 120–150 | BLOCKED / OUTSIDE_DEMAND_DOMAIN |
| A13 | Doğrusal model aralık ucunda doluluk < 0 veya > 1 | BLOCKED; sessiz kırpma yok |
| A14 | Noktalar fiyatla artan doluluk içeriyor | BLOCKED / NON_MONOTONE_DEMAND |
| A15 | Senaryo noktaları ve referans yok | READY; baz kıyaslaması yok |
| A16 | Aynı snapshot ve sürümler tekrar çalıştırılıyor | Aynı numerik sonuç, aday sırası ve bağlayıcı kısıtlar |
| A17 | Hesaplama sonrası Case değişiyor | Önceki sonuç güncel değil |
| A18 | Yuvarlanmış ADR minimum doluluğu ihlal ediyor | Uygulama fiyatı ihlali açık gösterilir |

Ek birim testleri: her talep segmentinin iki ucunda interpolasyon, yüzde puanı dönüşümü, min doluluk kesişimi, tolerans sınırları, tie-break ve sıfır baz RevPAR. En az bir bağımsız test referansı analitik çözümü kullanmalı; yalnızca üretim kodunu tekrar eden testler yeterli değildir.

## 11. Geliştirme sırası ve teslimatlar

| İş | Bağımlılık | Teslimat / kabul |
|---|---|---|
| T01 Veri şemaları ve sayısal politika | Bu sözleşme | Taslak/Problem ayrımı, birimler, doğrulama testleri |
| T02 Talep ve RevPAR skill'leri | T01 | İki model ve elle doğrulanan sayısal testler |
| T03 Kısıtlar ve readiness | T01–T02 | Alan bazlı eksikler/hatalar; A08–A15 |
| T04 Problem oluşturucu | T03 | Değişmez sürümlü snapshot; yanlış çağrı reddi |
| T05 Çözücü | T02–T04 | A01–A07; deterministik tie-break |
| T06 Sonuç ve açıklama | T05 | Ham/gösterilen değer ayrımı; INFEASIBLE davranışı |
| T07 Wizard ve Case kaydı | T03–T06 | Eksik alan akışı, özet/onay, sonuç güncelliği |
| T08 Grafikler ve uçtan uca test | T07 | Kullanıcı akışı, grafik ve tablo tutarlılığı |
| T09 VALIDATED / LOCK değerlendirmesi | T08 | Doğrulama raporu, sürüm ve kabul kaydı |

Case kaydı ilk prototipte yerel saklama olabilir; şema sürümü ve yüklenen verinin yeniden doğrulanması zorunludur. Çok kullanıcılı kalıcı saklama bu MVP'nin kabul koşulu değildir.

Tek geliştirici için ön tahmin: 3–4 hafta. İlk hafta çekirdek sözleşmeler ve skill'ler; ikinci hafta readiness/problem/solver; üçüncü hafta kullanıcı akışı; dördüncü hafta doğrulama ve düzeltmeler. Gerçek süre uygulama ortamı ve kabul sonuçlarına göre güncellenir.

## 12. LOCK kapısı

LOCK için aşağıdakilerin tümü gerekir:

- Kabul tablosu ve ilgili birim/entegrasyon/uçtan uca testler geçer.
- Örnek sonuçlar bağımsız hesapla doğrulanır.
- Kullanıcı girdilerinin birim ve anlamı arayüzde açık görünür.
- Veri hazır olmadan çözücü çalıştırılamaz.
- Uygulanabilir çözüm yokken başarı sonucu üretilmez.
- Formül, model ve sayısal politika sürümleri kaydedilir.
- Sınırlamalar ve talep varsayımları sonuçta görünür.
- Kabul eden kişi, tarih ve doğrulama kanıtı kaydedilir.

Testlerin geçmesi LOCK için gereklidir; tek başına finansal/ürün kabulü değildir. Bu belge oluşturulduğunda durum DRAFT olarak kalır.

## 13. Blueprint ile uzlaştırılan noktalar

- Case First korunur; gerekli alanlar seçilen probleme göre belirlenir.
- Doluluk bazı akışlarda kullanıcı girdisi, MAX RevPAR'da model çıktısıdır.
- Reference ADR/doluluk doğrusal duyarlılıkta zorunlu, senaryo noktalarında kıyaslama için opsiyoneldir.
- Readiness ve solver sonucu farklı durum kümeleridir.
- Talep noktaları ve duyarlılık modeli farklı girdiler ister.
- Sürekli aralık optimumu, fiyat tarama adımına bağlı yaklaşık optimumdan ayrılır.
- Wizard onayı hesaplama öncesi somut varsayım özetinde alınır.
- NOI köprüsü, DCF nakit akışı/terminal değer ve IRR davranışı sonraki ayrı sözleşmelerde standardize edilir.
