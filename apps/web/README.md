# Gelir Motoru — web uygulaması

## Yerelde çalıştırma
```bash
git clone https://github.com/senoltulga/hotel-decision-os.git
cd hotel-decision-os
git checkout feat/saas-skeleton
cd apps/web
cp .env.example .env.local   # iki değeri doldur (aşağıya bak)
npm install
npm run dev                  # http://localhost:3000
```

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://nipsqpbwvfifxmoopqbi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase panelinde Project Settings > API Keys > publishable key>
```

## Test akışı
1. /register → e-posta + 10+ karakter şifre + onay kutusu
2. Gelen kutusundaki doğrulama bağlantısına tıkla → /app açılır
3. /app: doluluk/ADR değiştir, geri dönüş süresi anında güncellenir (baz 11,7 yıl)
4. Çıkış yapmadan /app adresi açık kalır; oturumsuz /app → /login
