# T12 — Tarihsel talep, AI sınırı, yaşam döngüsü ve kapanış denetimi

Tarih: 7 Ekim 2026. Durum: kodlandı ve otomatik testlerle doğrulandı. Kalıcı LOCK kaydı değildir.

## Kod ve test kapsamı

- [src/domain/skills/historical-demand.skill.ts](../../src/domain/skills/historical-demand.skill.ts)
- [src/domain/guide/ai-assistant.adapter.ts](../../src/domain/guide/ai-assistant.adapter.ts)
- [src/domain/lifecycle/model.lifecycle.ts](../../src/domain/lifecycle/model.lifecycle.ts)
- [tests/unit/assistant.test.ts](../../tests/unit/assistant.test.ts)
- [tests/unit/lifecycle.test.ts](../../tests/unit/lifecycle.test.ts)

## Gerçek kanıt

- [Örnek çıktı](example.json)
- [Tüm testler](../validation/test-results.tap): 152 test, 152 başarılı, 0 başarısız.
- [Strict tip kontrolü](../validation/typecheck.txt): başarılı.
- [Kaynak ve build hash manifesti](../validation/manifest.json).

İlgili modül testleri ve kullanıcı akışları manifestte listelenir. UI kanıtı JSDOM etkileşim testidir; gerçek tarayıcı ekran görüntüsü veya uzman finansal kabulü yerine geçmez.

## Yeniden üretme

Node.js 24+ ile proje kökünde `npm run artifact:all`. Finansal varsayım ve kapsam sınırları [finans sözleşmesinde](../../FINANCIAL_MODEL_CONTRACT.md) açıklanır.

## MAX RevPAR teknik baseline

[release/flow-baseline.json](../../release/flow-baseline.json) kayıtlıdır. Kullanıcının görevlendirmesi altında teknik sözleşmenin test bazlı kabulü yapılmıştır; finansal model sertifikasyonu veya bağımsız iş kabulü değildir. Ayrı finans modülleri teknik olarak doğrulanmış, kalıcı LOCK yapılmamıştır.
