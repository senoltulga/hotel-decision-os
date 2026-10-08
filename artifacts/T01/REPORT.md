# T01 — Veri şemaları ve sayısal politika

Tarih: 7 Ekim 2026  
Durum: T01 uygulandı ve testlerle doğrulandı. MAX RevPAR akışı henüz VALIDATED/LOCKED değil.

## Teslim

- `src/domain/case/case.types.ts`: eksik Case taslağı, analiz için gereken Case, iki ayrımlı talep modeli ve doğrulama sonuçları.
- `src/domain/case/case.schema.ts`: dış veri doğrulaması; birimler, tarihler, sürümler, fiyat/doluluk aralıkları, talep noktaları ve model alanı.
- `src/domain/numerics/numerical-policy.ts`: sürümlü toleranslar, ondalık virgül desteği, eksik/sıfır ayrımı ve açık yüzde dönüşümleri.
- `src/domain/variables/variable.types.ts`: bir metriğin birden fazla problem rolü taşıması.
- `src/domain/problems/problem.types.ts` ve `problem.schema.ts`: çalıştırılabilir problem sözleşmesi, Case ile sınır tutarlılığı, değişmez snapshot.
- Node test çalıştırıcısı, TypeScript tip kontrolü ve sabitlenmiş geliştirme bağımlılıkları.

## İnceleme örneği

145 USD referans ADR ve %55 doluluk; fiyat sınırları 130–150 USD; 5 USD artış başına 2 yüzde puanı düşüş. Bu task girdinin geçerli olduğunu doğrular; optimumu hesaplamaz.

`example.json`, geçerli Case ve eksik Case için gerçek şema çıktısını içerir. Eksik minimum ADR sıfıra çevrilmez; `REQUIRED_FIELD` hatası alınır.

## Doğrulama

- 16 birim test: 16 geçti, 0 başarısız.
- TypeScript strict tip kontrolü: başarılı.
- Gerçek çalıştırma kanıtı: `test-results.tap` ve `typecheck.txt`.
- Kullanılan runtime: Node.js v24.21.0; resmi dağıtımın SHA-256 değeri doğrulandı. Runtime çalışma klasörüne eklenmedi.

## Sınırlar ve sonraki iş

T01 bir şema teslimidir. Talep hesaplama, RevPAR skill'i, readiness durumları, kısıt çözümleri, problem builder, optimizasyon ve arayüz sonraki task'lardadır. Doğrusal modelin uçlarda 0–1 dışında doluluk üretmesi hesaplama skill'i geldiğinde T02/T03 kapsamında doğrulanacaktır. Dolayısıyla şema başarısı tek başına solver çalıştırma izni değildir.

Sürekli fiyat modeli korunur. Fiyatların para birimine göre uygulanabilir adımlara yuvarlanması bu task kapsamında değildir. Tek ondalık ayırıcı ondalık olarak kabul edilir; binlik ayırıcı kullanılmamalıdır.

Sonraki task: T02 — iki talep modeli ve RevPAR hesaplama skill'leri; bağımsız analitik örneklerle doğrulama.
