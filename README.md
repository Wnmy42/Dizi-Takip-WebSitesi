# BingeTrack 🎬

Kişisel dizi takip uygulaması. İzlediğin dizileri listele, bölüm bölüm ilerlemeni işaretle, keşfet.

## Tech Stack

| Katman | Teknoloji |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript) |
| Stil | Tailwind CSS v4 + shadcn/ui |
| Veri | TMDB API |
| Backend / DB | Supabase (PostgreSQL + Auth) |
| State | Server Actions + TanStack Query |

## Özellikler

- 🔍 Popüler / trend dizileri keşfet, anlık arama
- 📺 Dizi detayları: özet, tür, puan, sezon/bölüm listesi
- 📚 Kütüphane: İzliyorum / İzleyeceğim / Tamamlandı / Bıraktım
- ✅ Bölüm takibi — tek tıkla izlendi işaretle
- 📊 İlerleme yüzdesi ve devam et butonu

## Kurulum

### 1. Repoyu klonla

```bash
git clone https://github.com/Wnmy42/Dizi-Takip-WebSitesi.git
cd Dizi-Takip-WebSitesi
npm install
```

### 2. Ortam değişkenlerini ayarla

```bash
cp .env.example .env.local
```

`.env.local` dosyasını düzenle:

| Değişken | Nereden Alınır |
|---|---|
| `TMDB_READ_ACCESS_TOKEN` | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API |

### 3. Veritabanını kur

Supabase SQL Editor'da [`supabase-migrations.sql`](./supabase-migrations.sql) içeriğini çalıştır.

### 4. Geliştirme sunucusunu başlat

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) adresinde açılır.

## Klasör Yapısı

```
app/
├── (auth)/          # Login / Register sayfaları
├── (app)/           # Auth gerektiren sayfalar
│   └── library/     # Kullanıcı kütüphanesi
├── discover/        # Halka açık keşfet sayfası
├── shows/[id]/      # Dizi detay sayfası
└── globals.css
components/
├── ui/              # shadcn/ui bileşenleri
├── site-header.tsx
├── show-card.tsx
├── episode-list.tsx
└── ...
lib/
├── tmdb/            # TMDB API client ve tipler
└── supabase/        # Supabase client, actions ve tipler
```

## Geliştirme Yol Haritası

- [x] Next.js kurulum, Tailwind, shadcn/ui
- [x] TMDB entegrasyonu (discover + search)
- [x] Supabase Auth + veritabanı şeması
- [x] Kütüphane ve bölüm takibi
- [x] İlerleme çubuğu ve UX polish
- [ ] Favori diziler
- [ ] Puan verme (1-10)
- [ ] İstatistik sayfası
- [ ] Vercel deploy

## Lisans

MIT
