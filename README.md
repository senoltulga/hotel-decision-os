# Hotel Decision Support Engine

16 analiz aracı olan, yerel çalışan deterministik otel karar destek uygulaması.

## Aç ve dene

Çalışan uygulama: http://localhost:8766/

1. **Örneği yükle** seçin. Örnekler piyasa verisi değildir.
2. Analiz aracını seçip **Bu araçla devam et** ile açıklamayı kabul edin.
3. Eksikleri tamamlayın. Mevcut girdileri değiştirmek için **Yalnız eksik veya geçersiz alanları göster** seçimini kaldırın.
4. **Varsayımları gözden geçir**, ardından **Onayla ve hesapla**.
5. Sonuç, kısıtlar, grafikler ve hesaplama izini inceleyin. Girdi değişince sonuç güncelliğini kaybeder.

## Yerel çalıştırma

Node.js 24 veya üzeri gerekir:

```sh
npm ci
npm run build
npm start
```

Sunucu yalnız 127.0.0.1 üzerinde çalışır. Varsayılan port 8766; `HDSE_PORT` ile değiştirilebilir. `/`, `/index.html` ve önceki bağlantıyla uyumluluk için `/simulation.html` aynı güncel uygulamayı sunar.

Bu görevde Node.js resmi dağıtımdan SHA-256 doğrulamasıyla geçici runtime'a kurulmuştur. Sistemde Node yoksa görev runtime'ıyla komut şöyle çalıştırılabilir:

```sh
PATH=/private/tmp/hdse-runtime/node-v24.21.0-darwin-arm64/bin:$PATH npm start
```

Geçici runtime kalıcı kurulum değildir; sonraki bilgisayar oturumlarında Node.js 24+ sistemde bulunmalıdır.

## Modüller

- Simülasyon: What-if, A/B, senaryo, duyarlılık, stres.
- Maksimizasyon: RevPAR, NOI, NPV, yatırım değeri.
- Minimizasyon: OPEX, CapEx, risk endeksi, geri ödeme süresi.
- Çok amaçlı: RevPAR/doluluk, NOI/OPEX, NPV/risk/CapEx Pareto kümeleri.
- Finans: ADR, kapasite, gelir, OPEX, GOP, EBITDA, NOI, cash flow, DSCR, direct cap, terminal, DCF, NPV, IRR ve payback.
- Talep: doğrusal duyarlılık, senaryo noktaları ve karşılaştırılabilir tarihsel gözlemlerden deterministik uyum.
- Ortak akış: Case, missing-data readiness, kısıtlar, immutable problem, açıklamalar, yerel taslak, Case/result export ve import.
- Rehber: kural tabanlı öneriler, opsiyonel LLM adapter sınırı, model yaşam döngüsü.

MAX RevPAR sürekli aralıkta analitik çözülür. Diğer optimizasyonlar tanımlanan fiyat adımı veya açık karar seçenekleri üzerinde tam karşılaştırma yapar. Risk/hizmet puanları kullanıcı girdisidir. AI sağlayıcısı varsayılan olarak bağlı değildir; uygulama LLM olmadan çalışır.

## Test ve artifact

```sh
npm run check
npm run artifact:all
npm run baseline:revpar
npm run verify:release
```

`artifact:all` kaynakları paketler, birim ve JSDOM uçtan uca testlerini çalıştırır, T05–T12 raporlarını/örneklerini ve hash manifestini üretir. `baseline:revpar` mevcut LOCKED v1.0 kaynaklarını korur; kaynaklar değiştiyse sessizce yeniden kilitlemez. T01–T04 önceki teslim kanıtları olarak saklanır.

- [Kapsam ve task eşleme denetimi](IMPLEMENTATION_AUDIT.md)
- [Finansal model sözleşmesi](FINANCIAL_MODEL_CONTRACT.md)
- [Gerçek test raporu](artifacts/validation/test-results.tap)
- [Kaynak/build manifesti](artifacts/validation/manifest.json)
- [MAX RevPAR teknik baseline](release/flow-baseline.json)
- [Yerel uygulama kopyası](artifacts/T07/workbench.html)

Gerçek tarayıcı screenshot/visual kabulü bilgisayar kullanım izinleri nedeniyle yapılamadı; UI davranış kanıtı JSDOM testleridir. Teknik MAX RevPAR baseline bağımsız finansal değerleme veya vergi mevzuatı sertifikası değildir. Ayrı finansal sözleşmenin varsayımları ve IRR'nin çok işaret değişimli akışlardaki durumları finans sözleşmesinde açıklanır.
