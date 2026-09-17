# BingeTrack 🎬

Kişisel dizi takip uygulaması. İzlediğin dizileri listele, bölüm bölüm ilerlemeni işaretle, keşfet.

## Tech Stack

| Katman | Teknoloji |
|---|---|
| Frontend | Next.js 16.3.5 (App Router, TypeScript) |
| Stil | Tailwind CSS v4 + shadcn/ui |
| Veri | TMDB API |
| Backend / DB | Supabase (PostgreSQL + Auth) |
| State | React durumları + Server Actions |

## Özellikler

- 🔍 Popüler / trend dizileri keşfet, anlık arama
- 📺 Dizi detayları: özet, tür, puan, sezon/bölüm listesi
- 📚 Kütüphane: İzliyorum / İzleyeceğim / Tamamlandı / Bıraktım
- ✅ Bölüm takibi — tek tıkla izlendi işaretle
- 📊 İlerleme yüzdesi ve devam et butonu
- ❤️ Kütüphanedeki dizileri favorilere ekle/çıkar
- ⭐ Dizi detayında ve kütüphanede kişisel 1–10 puan ver, değiştir veya temizle
- 🛡️ Aramada girdi sınırları, kalıcı hız limiti ve TMDB geçici hata dayanıklılığı

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

Bu dosya **yeni veritabanı kurulumu** içindir. Mevcut veritabanında bootstrap dosyasını yeniden çalıştırma; `supabase/migrations/` altındaki migration'ları tarih sırasıyla uygula. Favori migration'ı 15 Eylül, veri bütünlüğü migration'ı 16 Eylül ve [`20260916235500_add_search_rate_limit.sql`](./supabase/migrations/20260916235500_add_search_rate_limit.sql) 17 Eylül 2026'da mevcut canlı Dizi-Takip projesine uygulandı. Migration'lar tekrar uygulanabilir; mevcut veri, RLS politikaları ve görünüm izinleri korunur.

### 4. Geliştirme sunucusunu başlat

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) adresinde açılır.

## Klasör Yapısı

```
app/
├── (auth)/          # Login / Register sayfaları
├── (app)/library/   # Auth gerektiren kullanıcı kütüphanesi
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
- [x] CI, tip kontrolü ve Vitest test altyapısı
- [x] Next.js 16 `proxy.ts` oturum yenileme yapısı
- [x] Çevrimdışı/CI uyumlu sistem fontları
- [x] Favori diziler
- [x] Kişisel 1–10 puan verme, değiştirme ve temizleme
- [x] Server Action runtime doğrulaması ve veritabanı `CHECK` kısıtları
- [x] Public arama koruması ve TMDB retry/backoff akışı
- [ ] Kişisel dizi notları
- [x] Sezon accordion ve talep üzerine bölüm yükleme
- [ ] İstatistik sayfası
- [ ] Vercel deploy

## Güncel Durum

Son doğrulama: **17 Eylül 2026**

- Lint ve TypeScript kontrolü geçiyor.
- 20 test dosyasında toplam 188 test geçiyor; Server Action sınırları, arama girdi/body sınırları, kalıcı rate limit, TMDB retry/backoff, kontrollü hata arayüzü, migration atomikliği, accordion, bölüm toggle ve favori/puan akışları dahil.
- Üretim derlemesi geçiyor ve harici font indirmesine ihtiyaç duymuyor.
- Kullanılmayan TanStack Query bağımlılığı kaldırıldı; mevcut veri akışı Server Components ve Server Actions kullanıyor.
- Önceki bağımlılık doğrulamasında `npm audit` sonucu 0 güvenlik açığıydı; accordion çalışmasında audit yeniden çalıştırılmadı.
- React 19.3, ESLint 10, TypeScript 7 ve Node tipleri 26 gibi büyük sürüm geçişleri uyumluluk çalışması gerektirdiği için otomatik uygulanmadı.
- Supabase migration dosyasında `user_shows_with_progress` görünümü `security_invoker = true` olarak tanımlı.
- Canlı Supabase projesinde favori migration'ı uygulandı. İkinci bir JWT kimliğiyle show/view/episode çapraz erişimi transaction içinde sınandı; yetkisiz okuma, güncelleme ve silme sıfır satır döndürdü, bölüm ekleme RLS tarafından engellendi ve test değişiklikleri geri alındı.
- Canlı Supabase projesinde altı veri bütünlüğü `CHECK` kısıtı uygulandı ve `validated=true` olarak doğrulandı; mevcut 4 dizi ve 11 bölüm kaydı korundu.

## Arama koruması

- Arama metni sunucuda trim edilir ve iç boşluklar sadeleştirilir; 2–100 karakter sınırı ile kontrol/NUL karakter reddi TMDB çağrısından önce uygulanır.
- `/api/search` aramaları istemci başına 60 saniyede 10 istekle sınırlanır. Sayaç Supabase RPC içinde atomik tutulduğu için Vercel'in birden fazla sunucu örneğinde ortaktır. Ham IP saklanmaz; yalnız mevcut server secret ile üretilen HMAC parmak izi veritabanına yazılır.
- TMDB istekleri 8 saniyede zaman aşımına uğrar. Ağ hataları, 408, 425, 429 ve 5xx yanıtları en fazla üç toplam deneme ve sınırlı exponential backoff ile yeniden denenir; `Retry-After` dikkate alınır. Diğer 4xx yanıtları yeniden denenmez.
- Kota, hız limiti, bozuk upstream yanıtı ve geçici servis hataları kullanıcıya sabit mesajlarla gösterilir; upstream ayrıntıları istemciye dönmez.
- Bu P0.3 kapsamı yalnız kullanıcı aramasını korur. Popüler ve trend bölümlerinin ayrı hata/fallback arayüzü sonraki dayanıklılık çalışmasına bırakılmıştır.
- `supabase/migrations/20260916235500_add_search_rate_limit.sql` 17 Eylül 2026'da canlıya uygulandı. RLS ve `SECURITY DEFINER` doğrulandı; tablo erişimi `anon`/`authenticated` için kapalı, RPC çalıştırma yetkisi yalnız `service_role` rolünde. Yeni kurulum bootstrap SQL'i aynı tablo ve RPC tanımını içerir.

## Favori ve kişisel puan akışı

- Önce diziyi kütüphanene ekle. Detay ve kütüphane kartlarından favori durumunu değiştir; “Kişisel puanım” seçiminden 1–10 puan ver. “Puan yok” kayıtlı puanı temizler. TMDB puanı ayrı gösterilir.
- Favori ve puan birbirinden bağımsız kaydedilir. İstek sürerken kontroller kilitlenir; hata halinde eski değer korunur ve aynı kontrolle yeniden denenebilir.
- Server Actions girdileri çalışma zamanında doğrular ve güncellemeyi oturumdaki kullanıcıya sınırlar. Başarılı işlem `/library` ve veritabanından alınan TMDB kimliğinin detay yolunu yeniler.
- Şemaya yalnız `is_favorite boolean NOT NULL DEFAULT false` eklendi; mevcut nullable `rating` ve 1–10 kısıtı korunur. İlerleme görünümü eski sütun sırasını ve `security_invoker=true` ayarını korur.
- `npm test`, PGlite üzerinde eski şemadan yükseltme, tekrar migration, temiz kurulum, veri/ilerleme/izin koruması ve iki sentetik kullanıcının RLS izolasyonunu da sınar. Test veritabanı geçicidir; `.env.local` veya canlı Supabase kullanılmaz. Gerçek Supabase oturumu üzerinden uçtan uca yazma testi ayrıca yapılmalı.

## Sezon yükleme akışı

- İlk açılışta yalnız sezon özetleri gösterilir; özel sezonlar (sezon 0) önceki davranış gibi listelenmez.
- Sezon açılınca `/api/shows/[id]/seasons/[seasonNumber]` çağrılır. TMDB erişimi ve token sunucuda kalır; mevcut 3600 saniyelik TMDB fetch önbelleği korunur.
- Sayfa bileşeni yaşadığı sürece başarılı sezon yanıtları tekrar kullanılır; aynı dizi/sezon için devam eden istekler birleştirilir. Tam sayfa yenilemesi istemci önbelleğini sıfırlar.
- Her sezonda yükleniyor, boş sonuç ve hata/“Tekrar dene” durumları vardır; başka sezonu açmak hatalı sezonu otomatik yeniden çağırmaz.
- Bölüm verisi önbelleğe alınırken kullanıcı izlenme bilgisi güncel props üzerinden gelir. Supabase `toggleEpisode`, sahiplik kontrolü ve yol yenilemeleri değişmedi; yinelenen `user_shows` sorgusu kaldırıldı.
- Etkileşim testleri React Testing Library + Happy DOM kullanır. Canlı TMDB/Supabase ile giriş ve gerçek bölüm yazma uçtan uca testi bu çalışmada yapılmadı.

## Lisans

[MIT](./LICENSE)

## Kütüphane kategori testleri (17 Eylül 2026)

Gerçek sekme ve durum seçici bileşenleriyle üç dizi üzerinden kategori ayrımı, sayaçlar, boş durum ve durum değişikliği sonrası yeni sunucu verisiyle taşınma doğrulandı. Favori/puan ve bölüm ilerlemesi beklentileri korundu. Kategori filtresi geçici kaldırıldığında iki test başarısız oldu; üretim dosyası eksiksiz geri yüklendi. Bu HappyDOM etkileşim testi, gerçek tarayıcı veya canlı Supabase E2E testi değildir.

Lint, typecheck, 18 dosyada 163 test ve production build başarılı.

## Aynı dizinin güncel kişisel verileri (17 Eylül 2026)

P2.8: Aynı dizi kimliğine yeni favori/puan verisi geldiğinde görünümün yenilendiği ve eski hata mesajının temizlendiği etkileşim testi eklendi. Farklı diziye geçiş testi ayrıca korundu. React anahtarını yalnız dizi kimliğine indiren geçici değişiklik yeni testi kırdı; üretim dosyası geri yüklendi. Supabase action'ları taklit edilir; canlı E2E değildir.

Lint, typecheck, 20 dosyada 186 test ve production build başarılı.

## TMDB istemci sözleşmesi (17 Eylül 2026)

P2.7 tamamlandı: doğru Bearer başlığı ve özel/Unicode karakterli aramanın sayfa parametresiyle kodlanması test edildi. Token yokken istek yapılmaması, HTTP hata/retry ve URL ayracı testleri korundu. Geçersiz Authorization ile yeni test başarısız oldu; üretim kodu geri yüklendi. Fetch taklit edilir; canlı TMDB isteği yapılmaz.

Lint, typecheck, 20 dosyada 188 test ve production build başarılı.

## Katkı ve güvenlik

- [Katkı rehberi](./CONTRIBUTING.md): kurulum, değişiklik kapsamı ve kalite kontrolleri.
- [Güvenlik bildirimi](./SECURITY.md): hassas ayrıntıları paylaşmadan özel bildirim kanalı bulma.
- [Kod sahipliği](./.github/CODEOWNERS): varsayılan inceleme sahibi. Zorunlu onay ve dal koruması ayrıca yapılandırılmalıdır; P1.4 kapsamında açıktır.
