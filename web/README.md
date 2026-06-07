# EtkinlikScout

> **Plan senden, kalabalık bizden.** En iyi etkinlik, doğru kişilerle.

Türkiye'nin etkinlik arkadaşı ağı — biletli platformlar + belediye + üniversite etkinlikleri tek arayüzde, 12 dilde, public REST API'siyle. Keşfet, RSVP'le, ekibini topla, birlikte git.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcengizkaraaslan%2Fetkinlikscout&env=DATABASE_URL,AUTH_SECRET,AUTH_GOOGLE_ID,AUTH_GOOGLE_SECRET,CRON_SECRET&envDescription=PostgreSQL%20URL%20%2B%20Auth%20%2B%20Cron%20secrets&envLink=https%3A%2F%2Fgithub.com%2Fcengizkaraaslan%2Fetkinlikscout%2Fblob%2Fmaster%2F.env.example&project-name=etkinlikscout&repository-name=etkinlikscout)

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind v4** + **Framer Motion** (animasyonlar)
- **next-intl** — 12 dil (TR/EN/AR/DE/FR/ES/RU/IT/ZH/JA/PT/FA), RTL desteği
- **Prisma 6** + **PostgreSQL** (DB)
- **NextAuth v5** (Google OAuth, DB session veya JWT fallback)
- **Cheerio** ile gerçek HTML scraping (İBB için yazılı, diğerleri mock)
- **OOP scraper mimarisi** — yeni kaynak eklemek için bir sınıf yaz, registry'ye kaydet
- Mock **PaymentProvider** soyutlaması — Stripe/iyzico anahtarları eklendiğinde aktif

## Hızlı başlangıç (local)

```bash
git clone https://github.com/cengizkaraaslan/etkinlikscout.git
cd etkinlikscout
npm install
cp .env.example .env.local
# .env.local içinde USE_MOCK_DATA=true bırak → DB olmadan çalışır
npm run dev
```

→ http://localhost:3000

## Docker

Multi-stage Dockerfile + standalone output (~150 MB final image).

```bash
# Build & run
docker compose up -d --build

# Logs
docker compose logs -f app

# Stop
docker compose down
```

→ http://localhost:3000

Postgres + DB-backed çalışmak için `docker-compose.yml`'deki postgres bloğunu aç + `USE_MOCK_DATA=false` yap.

Manuel:
```bash
docker build -t etkinlikscout .
docker run -p 3000:3000 -e USE_MOCK_DATA=true etkinlikscout
```

## Vercel'e deploy (3 dakika)

### Seçenek 1: Tek tıkla
Yukarıdaki **Deploy with Vercel** butonuna tıkla. Vercel formu otomatik doldurur, env değişkenlerini ister.

### Seçenek 2: Manuel

1. **DB kur** → [neon.tech](https://neon.tech) (ücretsiz Postgres) veya [Vercel Postgres](https://vercel.com/storage/postgres) aç, connection string'i kopyala
2. **Google OAuth** (opsiyonel)
   - https://console.cloud.google.com → Yeni proje → OAuth consent screen → OAuth client ID (Web)
   - Authorized redirect URIs: `https://<senin-domain>.vercel.app/api/auth/callback/google`
3. **Vercel'e bağla**
   ```bash
   npm i -g vercel
   vercel login
   vercel link
   ```
4. **Env değişkenlerini ekle** (Vercel Dashboard → Settings → Environment Variables):
   | Key | Değer |
   |---|---|
   | `DATABASE_URL` | `postgresql://...` (Neon/Vercel Postgres) |
   | `AUTH_SECRET` | `openssl rand -base64 32` çıktısı |
   | `AUTH_GOOGLE_ID` | Google Console'dan |
   | `AUTH_GOOGLE_SECRET` | Google Console'dan |
   | `CRON_SECRET` | rastgele 32 char (cron auth için) |
   | `USE_MOCK_DATA` | `false` (gerçek scraping için) |
5. **Deploy**
   ```bash
   vercel --prod
   ```
6. **DB migration**
   ```bash
   vercel env pull .env.production.local
   npx prisma migrate deploy
   ```
7. **Vercel Cron** — `vercel.json` zaten yazılı, her 30 dk `/api/cron/scrape`'i tetikler

## Klasör yapısı

```
src/
  app/                    Pages + Route Handlers
    page.tsx              Anasayfa (hero + featured + free)
    etkinlikler/          Etkinlik listesi (filtre + arama)
    etkinlik/[slug]/      Detay (RSVP + yorumlar + katılımcılar)
    profil/[username]/    Public profil
    giris/                NextAuth Google login
    abonelik/             Pricing (Free/Pro/Business)
    api-docs/             Public API dokümantasyon
    admin/                Yönetim paneli
    api/v1/events/        Public REST API
    api/auth/             NextAuth handlers
    api/cron/scrape/      Vercel Cron endpoint
  auth.ts                 NextAuth v5 config
  proxy.ts                Auth middleware (/admin koruması)
  components/             UI bileşenleri (Header, EventCard, RsvpButtons, vs.)
  i18n/                   next-intl config (12 dil)
  lib/
    scrapers/             OOP scraper mimarisi
      BaseScraper.ts                 abstract
      TicketingScraper.ts            abstract (ücretli)
      MunicipalityScraper.ts         abstract (ücretsiz)
      ScraperRegistry.ts             factory + registry
      providers/
        BiletixScraper.ts
        BubiletScraper.ts
        MobiletScraper.ts
        PassoScraper.ts
        IBBScraper.ts                ← Cheerio ile gerçek parse
    payments/             PaymentProvider abstraction + Mock
    events.ts             Etkinlik servisi (DB veya mock)
    mock-data.ts          12 demo etkinlik
    auth-actions.ts       signIn / signOut server actions
    locale-actions.ts     Locale cookie değiştirme
prisma/schema.prisma      Tam DB şeması (User/Event/Attendance/Comment/...)
messages/                 12 dil JSON dosyaları
vercel.json               Cron config
```

## Yeni scraper ekleme

```ts
// src/lib/scrapers/providers/AnkaraBBScraper.ts
import { MunicipalityScraper } from "../MunicipalityScraper";
import * as cheerio from "cheerio";

export class AnkaraBBScraper extends MunicipalityScraper {
  source = "ANKARA_BB" as const;
  displayName = "Ankara Büyükşehir";
  baseUrl = "https://www.ankara.bel.tr";

  protected async fetchListing() {
    const html = await this.httpGet(`${this.baseUrl}/etkinlikler`);
    const $ = cheerio.load(html);
    const events = [];
    $(".event-card").each((_, el) => {
      events.push({
        source: this.source,
        externalId: $(el).attr("data-id") ?? "",
        title: $(el).find(".title").text(),
        // ... diğer alanlar
        startsAt: new Date(),
        venue: "Ankara",
        city: "Ankara",
        category: "DIGER",
        isFree: true,
      });
    });
    return events;
  }
}
```

`ScraperRegistry.ts`'ye `register(new AnkaraBBScraper())` ekle. Tamam.

## Public API

```bash
curl "https://etkinlikscout.vercel.app/api/v1/events?city=Istanbul&free=true&page=1" \
  -H "X-Api-Key: es_live_xxxx"
```

Detay: `/api-docs`

## Plan tiers

| Plan | Aylık | İstek/gün | Fiyat alarmı | Webhook |
|---|---|---|---|---|
| Free | ₺0 | 100 | — | — |
| Pro | ₺199 | 10.000 | ✓ | — |
| Business | ₺799 | 1M | ✓ | ✓ |

> Ödeme şu an **mock**. Stripe/iyzico anahtarları eklendiğinde gerçek checkout aktif.

## Web Push (Faz 4)

Yeni etkinlik eklendiğinde kategori bazlı tarayıcı bildirimi göndermek için VAPID anahtarlarını `.env.local` ve Vercel env'lerine ekle:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — `npx web-push generate-vapid-keys` çıktısının public kısmı
- `VAPID_PRIVATE_KEY` — aynı çıktının private kısmı
- `VAPID_SUBJECT` — örn. `mailto:you@example.com`

## Lisans

MIT
