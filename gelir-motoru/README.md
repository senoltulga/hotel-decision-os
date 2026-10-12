# Gelir Motoru (Yokuşbaşı) — v2.1 beta

Tek dosyalık web uygulaması (`public/index.html`). Vercel: Root Directory = `gelir-motoru`, framework yok, çıktı klasörü `public`.

- `release/` — kilitli v2.0 (salt okunur referans) + regresyon testi
- `tests/regression-v2.1.js` — Playwright regresyon testi (`node tests/regression-v2.1.js file:///.../public/index.html`)
- `supabase/migrations/` — gm_* tabloları, RLS ve kota fonksiyonları
- Beta kotası: hesap başına 20 analiz (sunucuda `gm_consume`)

Not: Repo public ise istemci kodu görünür. Kod koruması istenirse repo private yapılmalı.
