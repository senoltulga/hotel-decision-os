# T09 — Gelir, gider, GOP, EBITDA, NOI ve yatırım skill kütüphanesi

Tarih: 7 Ekim 2026. Durum: kodlandı ve otomatik testlerle doğrulandı. Kalıcı LOCK kaydı değildir.

## Kod ve test kapsamı

- [src/domain/skills/financial.skills.ts](../../src/domain/skills/financial.skills.ts)
- [src/domain/skills/valuation.skills.ts](../../src/domain/skills/valuation.skills.ts)
- [src/domain/finance/financial.engine.ts](../../src/domain/finance/financial.engine.ts)
- [tests/unit/finance.test.ts](../../tests/unit/finance.test.ts)

## Gerçek kanıt

- [Örnek çıktı](example.json)
- [Tüm testler](../validation/test-results.tap): 152 test, 152 başarılı, 0 başarısız.
- [Strict tip kontrolü](../validation/typecheck.txt): başarılı.
- [Kaynak ve build hash manifesti](../validation/manifest.json).

İlgili modül testleri ve kullanıcı akışları manifestte listelenir. UI kanıtı JSDOM etkileşim testidir; gerçek tarayıcı ekran görüntüsü veya uzman finansal kabulü yerine geçmez.

## Yeniden üretme

Node.js 24+ ile proje kökünde `npm run artifact:all`. Finansal varsayım ve kapsam sınırları [finans sözleşmesinde](../../FINANCIAL_MODEL_CONTRACT.md) açıklanır.
