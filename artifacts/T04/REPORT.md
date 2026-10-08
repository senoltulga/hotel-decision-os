# T04 — MAX RevPAR standart problem oluşturucu

Tarih: 7 Ekim 2026  
Durum: Kod ve task testleri tamamlandı. Ana MAX RevPAR akışı henüz LOCKED değildir.

## Teslim

- `src/domain/problems/max-revpar.builder.ts`: `buildMaxRevparProblem(input)` API'si.
- `src/domain/problems/problem.versions.ts`: sürüm sözleşmeleri tek yerde; hesaplama, talep ve sayısal politika sürümleri mevcut modüllerden alınır.
- `src/domain/problems/problem.schema.ts`: import edilen problemde readiness yeniden kontrol edilir; fiziksel olarak geçersiz talep, değiştirilmiş hedef/sınır/kısıt veya bilinmeyen sürüm reddedilir.
- `tests/unit/t04.test.ts`: 13 yeni test.
- `problem.json`: gerçek builder çıktısı; sonraki çözücü için standart girdi.
- `example.json`: READY, INCOMPLETE, BLOCKED ve karşılanamayan doluluk uyarısı örneklerinin gerçek sonuçları.

## Davranış

Builder dışarıdan READY etiketi kabul etmez; Case üzerinde hazırlık kontrolünü kendisi çalıştırır. READY olmadan problem alanı üretilmez. Başarılı sonuç hedefi `MAX RevPAR`, karar değişkenini `ADR` olarak sabitler; sınırları ve minimum doluluğu Case'ten alır.

Case kimliği, revizyonu, dönem, para birimi, referans ve talep varsayımları snapshot içinde taşınır. İç içe tüm problem verisi dondurulur. Orijinal Case veya readiness sonucu sonradan değiştiğinde problem değişmez. JSON'a aktarılıp yeniden yüklendiğinde tekrar doğrulanır.

Minimum doluluk verilmemişse fiziksel alt sınır 0 olur; verilmiş sıfır veya başka geçerli oran korunur. Minimum doluluk nedeniyle uygulanabilir fiyat bulunmayacağı uyarısı problem üretimini engellemez; feasibility çözücüden ayrılır.

Nokta modeli referanssız çalışır; referans verisi uydurulmaz. Hedef/karar/kısıt/sürüm envelope'u yalnız bilinen alanlardan oluşturulur. Case'in mevcut alanları snapshot'ta korunur.

## Test kanıtı

- T04: 13 yeni test geçti.
- T01–T03 dahil toplam: 71 test geçti, 0 başarısız.
- Strict TypeScript kontrolü: başarılı.
- Kanıt: `test-results.tap`, `typecheck.txt`.

Testler eksik/bozuk Case'i, sahte READY etiketini, snapshot izolasyonunu, derin dondurmayı, sürüm tutarlılığını, referanssız noktaları, deterministik tekrarları, JSON importunu, tek ADR'yi ve feasibility uyarısının korunmasını kapsar. Önceki 8 UI testi de geçti.

## Yeniden üretme

Node.js 24+ ile proje kökünde:

```sh
npm ci
npm run artifact:t04
```

## Sonraki task ve kapsam

T05 — MAX RevPAR çözücüsü. T04 fiyat aramaz, optimum veya INFEASIBLE sonucu üretmez. `solverVersion` gelecekteki çözücünün hedef sözleşmesini ifade eder; çalışan çözücü olduğu iddiası değildir.

Mevcut localhost ekranı tek fiyat simülasyonudur. T04 backend teslimidir; ekranda otomatik en iyi fiyat özelliği açılmadı. T05'te bu problem sözleşmesi kullanılarak optimum hesaplanacak.
