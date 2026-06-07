# MeydanFest — Android (Capacitor)

Bu proje hem **PWA** olarak hem de **Capacitor ile native APK** olarak çalışır.

## 1. PWA (en kolay, sıfır build)

Site açıldığında 8 saniye sonra animasyonlu "Uygulamayı yükle" pop-up'ı çıkar.

- **Android Chrome**: "Hemen yükle" → tek tık.
- **iPhone Safari**: Paylaş → "Ana Ekrana Ekle".
- **Desktop Chrome/Edge**: Adres çubuğundaki ⬇ ikon.

Yüklü uygulama:
- Standalone (tarayıcı çubuğu yok)
- Offline cache
- Push notification
- Native app gibi açılır

Kullanıcı "Şimdi değil" derse 7 gün soğuma süresi var. En fazla 4 kez gösterilir.

## 2. Capacitor APK (Google Play / FTP deploy için)

### Gerekli kurulum (bir kez)
- **Android Studio** (https://developer.android.com/studio)
- **JDK 17+**
- `ANDROID_HOME` env var Android SDK dizinine işaret etmeli
- `gradle` (Android Studio yükler)

### Android projesini oluştur (bir kez)

```bash
npm run cap:add:android
```

Bu komut `android/` klasörünü oluşturur. `capacitor.config.ts`'i okur.

### Geliştirme & sync

Her web tarafı değişikliğinde:

```bash
npm run cap:sync
```

Native config + plugin değişikliklerini Android projesine yansıtır.

### APK build

#### Debug APK (test için, FTP ile telefona göndermek)

```bash
npm run cap:build:apk
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

Memory'deki FTP deploy ile telefona at:
```
ftp://<telefon-ip>:2221/Download/
```

#### Release APK (Google Play için)

1. `android/app/src/main/res/values/strings.xml`'de app_name ayarla
2. Keystore oluştur:
   ```bash
   keytool -genkey -v -keystore meydanfest.keystore -alias meydanfest -keyalg RSA -keysize 2048 -validity 10000
   ```
3. `android/key.properties` oluştur (gitignore'da):
   ```properties
   storePassword=...
   keyPassword=...
   keyAlias=meydanfest
   storeFile=../meydanfest.keystore
   ```
4. Build:
   ```bash
   cd android && gradlew.bat assembleRelease
   ```

### Android Studio'da aç

UI ile düzenleme, ikon değiştirme, splash screen için:

```bash
npm run cap:open
```

## 3. Mimari

Capacitor APK, **WebView içinde** `capacitor.config.ts → server.url`'i yükler. Yani:
- Native APK = ince bir kabuk
- Tüm UI/UX Next.js sunucusundan gelir
- Backend güncelleyince APK'yı yeniden derlemeye gerek yok
- Web feature parity: %100

Trade-off: İlk açılışta ağ gerekir (yerel cache yapsa da). Tam offline app istiyorsan `output: "export"` Next.js modu + webDir'i değiştirmek gerekir — şu an mimari buna uygun değil (server actions, NextAuth, vs.).

## 4. Tarayıcı dışı özellikler (Capacitor plugins)

Halihazırda kurulu:
- `@capacitor/app` — back button handling
- `@capacitor/status-bar` — durum çubuğu rengi (mor)
- `@capacitor/splash-screen` — açılış animasyonu

Eklenebilecek populer pluginler:
- `@capacitor/camera` — kullanıcı kamera kullanımı (foto galeri için)
- `@capacitor/geolocation` — daha hassas konum (yakınımda için)
- `@capacitor/share` — native paylaş menüsü
- `@capacitor/preferences` — secure local storage

Eklemek için: `npm install @capacitor/<plugin>` → `npm run cap:sync`.

## 5. İkon ve splash

İkonlar `public/icon-*.png` dosyalarından geliyor (Capacitor sync zamanı kopyalar). Yeniden üretmek:

```bash
npm run icons
```

Splash screen için Android Studio'da `android/app/src/main/res/drawable/splash.png` değiştir.
