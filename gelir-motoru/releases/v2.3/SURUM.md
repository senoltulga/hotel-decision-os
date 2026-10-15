# Gelir Motoru v2.3 (KİLİTLİ, 15 Ekim 2026)

- Kaynak: `gelir-motoru/releases/v2.3/index.html` (446.089 bayt, SHA-256 başlangıcı b1f2fe5aaef58076). `gelir-motoru/public/index.html` ile aynıdır.
- Model sürümü kodda: 2.3 · proje dosyası şeması: 1
- Regresyon: `regression.cjs` (23 kontrol, hepsi geçti). Çalıştırma: `NODE_PATH=$(npm root -g) node regression.cjs`
- Kural: Bu sürüm değiştirilmez. Yeni çalışma `releases/v2.4/` (ya da v3) altında yapılır. Hata düzeltmesi v2.3.1 olarak bu kopyadan türetilir.

## v2.1'den bu yana eklenenler
- Şablonlar: Payback analizi, Değer hesapla, Vaka: Turgutreis 30 anahtar, Personel bütçesi (Payroll), P&L oluşturma.
- Sihirbazlar (7): hedef, DCF, içe aktarma, yeni rapor, değer hesapla, personel, P&L oluştur.
- Personel modülü sol menüde ve Payback'e gider olarak aktarım.
- P&L oluşturma: doluluk × ADR'den GOP, NOI, net nakit, geri dönüş, değer; duyarlılık; Payback'e aktarım (stabilize net nakit aynı).
- Yardım turları: Turgutreis (10 adım), Personel (5 adım).

## Kontrol değerleri
- Baz geri dönüş 11,68 yıl · temkinli 13,2 · güçlü 10,6 · yatırım 10.750.000 (renovasyon 2.500.000)
- 3. yıl: brüt 1.611.150 · GOP ≈1.005.659 · NOI ≈935.659 · net ≈871.213
- DCF yer tutucu: NPV ≈ −1.787.096, IRR ≈ %9,6
- P&L oluşturma örnek otel (30 oda, %65, 220 $): net nakit 854.765

## Bilinen sınırlar
- Kod istemcide açık, depo herkese açık; kullanım kotası dışında kod koruması yok.
- Canlı giriş ve veritabanı kaydı canlıda test edilmedi.
- Şablonlardaki örnek varsayımlar piyasa verisi değildir; Turgutreis otel alternatifinin dökümü yok.
- Excel (.xlsx) doğrudan okunmaz; CSV gerekir.
