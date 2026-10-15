# Yokuşbaşı Payback Akışı v1.0 (KİLİTLİ, 15 Ekim 2026)

- Kaynak: `payback-akisi/releases/v1.0/index.html` (24.544 bayt, SHA-256 başlangıcı 7619979cd3ef14e9)
- Git etiketi: `payback-akisi-v1.0`
- Regresyon: `regression.cjs` (15 kontrol, hepsi geçti). Çalıştırma: `NODE_PATH=$(npm root -g) node regression.cjs`
- Kural: Bu sürüm değiştirilmez. Yeni çalışma `releases/v1.1/` altında yapılır. Hata düzeltmesi v1.0.1 olarak bu kopyadan türetilir.

## İçerik
- 18 residence birimli Yokuşbaşı örneği: oda geliri, kira, departman gideri, GOP, NOI, net nakit.
- 2 yıl rampa, 3. yıldan sonra büyüme; kümülatif ve basit geri dönüş.
- Sürüklenebilir geri dönüş grafiği (1–3. yıl doluluk, yatırım, geri dönüş hedefi).
- Altında girdilere göre güncellenen teknik rapor; P&L akışı; doluluk duyarlılık tablosu.

## Kontrol değerleri (varsayılan girdiler)
- Brüt gelir 1.611.150 · GOP 1.005.661 · NOI 935.661 · net nakit 871.215 (3. yıl)
- Yatırım 10.750.000 (renovasyon 2.500.000) · kümülatif geri dönüş 11,7 yıl · basit 12,3 yıl
- Renovasyon 0 iken geri dönüş 9,4 yıl

## Bilinen sınırlar
- Sezon dağılımı, oda tipleri, KDV, kredi ve vergi yok; nominal ve iskontosuz.
- Girdiler kaydedilmez; sayfa yenilenince varsayılana döner.
- Kod istemcide açık, depo herkese açık.
