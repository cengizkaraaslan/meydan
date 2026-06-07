# Meydan — Monorepo ✦

Etkinlik + tanışma platformu. Tek repoda yönetilir.

```
meydan/
├── web/      → EtkinlikScout (Next.js) — Web + API (api, web/src/app/api altında)
└── mobile/   → MeydanFest (Expo / React Native) — Android uygulaması
```

## Klasörler

### `web/` — Web & API (EtkinlikScout)
Next.js 16 fullstack. Hem web sitesi hem de mobil uygulamanın kullandığı **API** burada:
- API uçları: `web/src/app/api/**` (örn. `/api/v1/events`, `/api/v1/profile`, `/api/v1/create-event`, `/api/v1/favorites`, `/api/v1/event-social`)
- Scraper altyapısı: `web/src/lib/scrapers/**`
- Prisma şeması: `web/prisma/schema.prisma`

```bash
cd web && npm install && npm run dev
```

> Not: "Api / Web" tek bir Next.js uygulamasıdır (Next route handlers = API). Ayrı bir backend yoktur.

### `mobile/` — Android uygulaması (MeydanFest)
Expo SDK 56 + expo-router. `web`'deki API'den beslenir.

```bash
cd mobile && npm install && npx expo start
# APK: npx expo prebuild --platform android && cd android && ./gradlew assembleRelease
```

## Geçiş notları
- Eski ayrı repolar (`etkinlikscout`, `meydanfest`) çalışır durumda; bu monorepo birleşik yönetim içindir.
- **Vercel**: web'i deploy etmek için proje kök dizinini `web/` yapın (Root Directory = `web`).
- Secrets (`.env.local`) repoya dahil değildir; Vercel/EAS ortam değişkenleriyle verin.
