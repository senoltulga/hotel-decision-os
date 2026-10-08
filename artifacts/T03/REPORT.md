# T03 — Kısıtlar, readiness ve etkileşimli fiyat simülasyonu

Tarih: 7 Ekim 2026  
Durum: T03 kodu ve simülasyon etkileşimleri testlerle doğrulandı; ana akış LOCKED değildir.

## Çalışan teslim

- `src/domain/constraints/constraint.validator.ts`: ADR sınırları, fiziksel doluluk, minimum doluluk, bağlayıcı kısıtlar ve sürümlü toleranslar.
- `src/domain/readiness/readiness.engine.ts`: READY / INCOMPLETE / BLOCKED; alan bazında eksik veri açıklaması, düzeltme önerisi ve uyarılar.
- `src/domain/simulation/simulate-price.ts`: hazır veride seçilen fiyatın doluluk/RevPAR hesabı ve grafik noktaları. Hazır olmayan veri için sonuç üretilmez.
- `src/features/simulation/`: gerçek domain modüllerini kullanan interaktif ekran. Finansal formüller arayüzde yeniden yazılmadı.
- `hotel-price-simulation.html`: sohbet içinde açılan, bağımsız paketlenmiş simülasyon. API çağrısı veya CDN bağımlılığı olmadan hesaplar.
- `scripts/create-t03-artifacts.ts`: ekranı yeniden paketler, test ve tip kontrolü kanıtlarını ve gerçek örnek JSON'unu üretir.

## Kullanıcı akışı

Varsayımlar örnek otel verileridir. Referans ADR, doluluk, talep duyarlılığı, fiyat sınırları ve minimum doluluk değiştirilir. “Simülasyonu hesapla” seçilen fiyatın sonucunu gösterir; slider aynı varsayımlar altında canlı fiyat denemesi yapar.

Varsayımlar elle değişince önceki sonuç gizlenir ve yeniden hesaplama istenir. Eksik/geçersiz veri hesaplama düğmesini kapatır. Model aralığı dışındaki fiyat için sonuç üretilmez. Minimum doluluk ihlalinde seçilen fiyatın matematiksel sonucu görünür ama fiyatın kısıtı karşılamadığı açıkça belirtilir.

Doğrusal modelde talep geçerlilik alanı, analiz fiyat sınırlarından ayrı saklanır. Analiz aralığı genişletilecekse “Talep modelinin geçerli fiyat aralığı” da gözden geçirilmelidir. Senaryo noktaları `fiyat; doluluk yüzdesi` biçiminde, satır başına bir nokta olarak girilir. Ondalık virgül veya nokta desteklenir; binlik ayırıcı kullanılmaz.

Para birimi seçimi tutarların birimini tanımlar; döviz dönüşümü yapmaz. Ekranda gösterilen tutarlar iki ondalığa yuvarlanır; ham hesaplama değerleri korunur.

## Test sonuçları

- T01 + T02 regresyonları: 33 geçti.
- T03 domain testleri: 17 geçti.
- Simülasyon ekranı etkileşim testleri: 8 geçti.
- Toplam: 58 başarılı, 0 başarısız.
- Strict TypeScript tip kontrolü başarılı.
- Gerçek kanıtlar: `test-results.tap`, `typecheck.txt`, `example.json`.

Ekran testleri paketlenmiş gerçek kodu JSDOM içinde çalıştırır. İlk render, fiyat değişimi, eski sonucu gizleme, boş alan, geçersiz yüzde, minimum doluluk ihlali, model seçimi, nokta hataları, slider, aralık dışı fiyat ve para birimi etiketi kontrol edilir.

### Tarayıcı doğrulamasının sınırı

Yerel önizleme sunucusu başlatıldı; ancak bilgisayarın Erişilebilirlik/Ekran Kaydı izinleri tamamlanmadığından gerçek tarayıcıda görsel kontrol tamamlanamadı. Ekran görüntüsü veya responsive görsel doğrulama kanıtı yoktur. JSDOM testleri gerçek tarayıcı render kontrolünün yerine geçtiği iddiasını taşımaz. CSS 320px ve üzeri genişliklere uyum için hazırlanmıştır; görsel kabul kontrolü sonraki arayüz değerlendirmesinde yapılmalıdır.

## Matematiksel örnek

145 USD / %55 referans, 5 USD artışa 2 yüzde puanı düşüş:

- 141.25 USD → %56.5 doluluk → 79.80625 USD RevPAR.
- Minimum doluluk %60 ve fiyat 145 USD → hesaplanan doluluk %55; fiyat kısıtı ihlal eder.
- Minimum doluluk %70 → veri READY kalır; hiçbir fiyatın doluluk şartını karşılamadığı uyarısı gelir. Bu bir solver INFEASIBLE sonucu değildir; çözücü henüz uygulanmadı.

## Yeniden üretme

Node.js 24+ ile proje kökünde:

```sh
npm ci
npm run artifact:t03
```

## Kapsam ve sonraki task

Bu ekran tek fiyat what-if simülasyonudur. Otomatik optimum seçimi, Case'i kalıcı saklama ve tam wizard kapsamı sonraki task'lardadır. T04 standart problem oluşturucu ve T05 çözücü tamamlanınca aynı hesaplama modülleriyle otomatik en iyi fiyat eklenecektir.

Readiness, kritik ilişki/veri hatasına BLOCKED önceliği verir; eksikler yine listelenir. Minimum doluluk nedeniyle çözüm bulunmaması veri hazırlığından ayrı tutulur. T03'ün tamamlanması LOCK kapısının geçtiği anlamına gelmez.
