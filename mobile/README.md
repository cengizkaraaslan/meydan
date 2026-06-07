# MeydanFest ✦

**Türkiye'nin etkinlik meydanı** — binlerce konser, festival, tiyatro, sergi ve atölyeyi tek bir sinematik arayüzde toplayan premium Android uygulaması.

> "Aurora" tasarım dili: derin koyu zemin, hareketli mor–mavi–pembe gradient ışıması ve cam (glassmorphism) yüzeyler.

## 📲 APK indir

En son sürümü **[Releases](../../releases/latest)** sayfasından indir:
1. `app-release.apk` dosyasına dokun.
2. Telefonda "Bilinmeyen kaynaklardan yükleme"ye izin ver.
3. Kur ve aç.

## ✨ Özellikler

- **Keşfet** — öne çıkan etkinlik karuseli, "bu hafta sonu", kategori filtreleri, yaklaşan akış
- **Kategoriler** — gradient kategori kartları (konser, festival, tiyatro, sergi, atölye, spor, çocuk…)
- **Takvim** — yaklaşan etkinlikler güne göre gruplu
- **Favoriler** — kalple kaydet, cihazda saklanır (offline)
- **Arama** — isim/sanatçı/mekan + kategori filtresi, anlık
- **Etkinlik detayı** — büyük görsel, tarih/mekan, haritada gör, bilet al, paylaş
- Canlı veri: 2100+ etkinlik (EtkinlikScout API)

## 🛠️ Teknoloji

- Expo SDK 56 + expo-router + React Native + TypeScript
- react-native-reanimated (animasyonlu aurora), expo-blur (cam), expo-linear-gradient
- Veri: [EtkinlikScout](https://etkinlikscout.vercel.app) public API (`/api/v1/events`)

## 🚀 Geliştirme

```bash
npm install
npx expo start            # geliştirme
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease   # APK üret
```

APK çıktısı: `android/app/build/outputs/apk/release/app-release.apk`
