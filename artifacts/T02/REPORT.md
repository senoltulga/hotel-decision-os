# T02 — Talep modelleri ve RevPAR hesaplama çekirdeği

Tarih: 7 Ekim 2026  
Durum: Uygulandı ve task testleriyle doğrulandı. Ana akış henüz LOCKED değildir.

## Teslim

- `src/domain/skills/revpar.skill.ts`: saf, sürümlü ADR × doluluk hesabı; geçersiz sayılar ve doluluk oranları reddedilir.
- `src/domain/skills/demand.skill.ts`: doğrusal duyarlılık ve parçalı doğrusal senaryo noktaları; bağımsız değişmez snapshot, segmentler ve fiyat bazında doluluk hesabı.
- `src/domain/skills/skill.types.ts`: başarı/değer veya alan bazında hata döndüren ortak skill sonucu.
- `tests/unit/t02.test.ts`: 17 yeni test; mevcut 16 T01 testi korunur.
- `scripts/create-t02-artifacts.ts`: testleri ve tip kontrolünü tekrar çalıştırarak gerçek örnek çıktılarını kaydeder; başarısız kontrolde durur.

## API

`compileDemand({ demand, minAdr, maxAdr, referenceAdr?, referenceOccupancy? })` geçerli analiz aralığı için derlenmiş bir model üretir. `model.occupancyAt(adr)` bu aralıkta doluluk oranını verir. Aralık dışında ekstrapolasyon yapılmaz.

`calculateRevpar(adr, occupancy)` aynı para biriminde ham RevPAR değerini üretir; gösterim yuvarlaması yapmaz. Skill para birimi dönüştürmez; Case'in para birimi caller tarafından taşınır.

Model derlenirken analiz aralığının uçlarındaki doluluk 0–1 dışında ise hata verilir. Doğrusal/parçalı doğrusal segmentler nedeniyle uçların doğrulanması tüm segmentin fiziksel sınırlarını doğrular. Kullanılmayan model alanı yerine istenen analiz aralığı kontrol edilir. Girdiler veya saklanan Case sonradan değişse bile mevcut model değişmez.

## Bağımsız sayısal örnekler

Doğrusal model: referans 145 USD / %55; 5 USD artış başına 2 yüzde puanı düşüş.

| Örnek ADR (USD) | Doluluk | RevPAR (USD) |
|---|---|---|
| 130 | %61 | 79.30 |
| 141.25 | %56.5 | 79.80625 |
| 145 | %55 | 79.75 |
| 150 | %53 | 79.50 |

141.25 burada elle seçilmiş kabul testi girdisidir; task bir optimum araması yapmaz.

Senaryo noktaları: (130, %65), (145, %55), (150, %50). 137.5 USD için doluluk %60; 147.5 USD için %52.5. 130 USD'de RevPAR 84.5 USD'dir. Bu model doğrusal duyarlılık örneğinden farklı bir talep varsayımı taşır.

## Test kanıtı

- Yeni T02 testleri: 17/17 başarılı.
- Toplam regresyon: 33/33 başarılı, 0 başarısız.
- Strict TypeScript kontrolü: başarılı, çıkış kodu 0.
- `test-results.tap`: gerçek test çıktısı.
- `typecheck.txt`: gerçek tip kontrolü çıkış kodu.
- `example.json`: runtime ve model sürümleri, örnek girdiler, segmentler, hesaplanan sonuçlar ve hata örnekleri.

Testler referans/uç/iç noktaları, iki yüzde puanı dönüşümünü, sabit doluluğu, tek fiyatı, eksik referansları, fiziksel sınır ihlalini, taşmayı, interpolasyonu, yinelenen/artan noktaları, snapshot değişmezliğini ve deterministik tekrarı kapsar.

## Tekrar çalıştırma

Proje kökünde Node.js 24+ ve `npm ci` sonrasında:

```sh
npm run artifact:t02
```

## Sonraki task

T03: Kısıt değerlendirmesi ve readiness. Bu task'ta minimum doluluk şartı uygulanmaz; geçerli talep modeli hazır olsa bile şartları karşılayan fiyat bulunmayabilir. INFEASIBLE kararını sonraki problem/çözücü akışı verecektir.
