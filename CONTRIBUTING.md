# Katkıda bulunma

BingeTrack'e katkı vermeden önce mevcut issue veya ilgili bakım ihtiyacını kontrol edin. Küçük ve odaklı pull request'ler tercih edilir.

## Geliştirme kurulumu

1. Node.js `>=22.12.0` kurulu olmalıdır.
2. Bağımlılıkları kilit dosyasına bağlı kalarak kurun:

   ```bash
   npm ci
   ```

3. `.env.example` dosyasını `.env.local` olarak kopyalayıp gerekli TMDB ve Supabase değerlerini ekleyin. Değerleri kaynak koda veya pull request'e eklemeyin.
4. Geliştirme sunucusunu çalıştırın:

   ```bash
   npm run dev
   ```

## Migration ve canlı veritabanı

Migration dosyalarını tarih sırasını ve mevcut migration düzenini koruyarak ekleyin. Yeni kurulum için `supabase-migrations.sql`, mevcut kurulum için `supabase/migrations/` altındaki migration'lar kullanılır. Katkı sırasında canlı veritabanında değişiklik yapmayın; SQL değişikliklerini yerel veya geçici bir test veritabanında doğrulayın.

## Göndermeden önce

CI ile aynı dört komutu çalıştırın:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Pull request açıklamasında değişikliğin amacını, test sonuçlarını ve migration etkisini belirtin. Gerekli ekran görüntülerini ekleyin ve gizli bilgileri paylaşmayın.
