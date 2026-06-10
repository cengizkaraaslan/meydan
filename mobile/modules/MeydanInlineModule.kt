package app.meydanfest.inline

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Expo SDK 56 "inline module" demo — ayrı paket oluşturmadan, uygulama içinde
 * doğrudan Kotlin native modül. Dosya adı (MeydanInlineModule) modül adıdır,
 * bu yüzden Name() yazmaya gerek yok; JS tarafı requireNativeModule("MeydanInlineModule").
 *
 * watchedDirectories: ["modules"] (app.json experiments.inlineModules) → prebuild
 * bu dosyayı bulup native projeye otomatik ekler.
 */
class MeydanInlineModule : Module() {
  override fun definition() = ModuleDefinition {
    // Native'den gelen sabit metin (JS'de MeydanInlineModule.greeting).
    Constant("greeting") {
      "Merhaba! Bu metin native (Kotlin) inline modülünden geliyor 🔥"
    }

    // Native cihaz bilgisi — gerçekten native kod çalıştığını gösterir.
    Function("deviceInfo") {
      mapOf(
        "model" to Build.MODEL,
        "manufacturer" to Build.MANUFACTURER,
        "androidSdk" to Build.VERSION.SDK_INT,
        "release" to Build.VERSION.RELEASE,
      )
    }
  }
}
