import type { Metadata } from "next";
import Link from "next/link";
import { Shield, Lock, Database, Eye, Trash2, Mail, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Gizlilik Politikası · MeydanFest",
  description:
    "MeydanFest gizlilik politikası — verilerinizi nasıl topluyor, nasıl kullanıyor ve nasıl koruyoruz.",
};

const LAST_UPDATED = "29 Mayıs 2026";

export default function GizlilikPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] mb-4"
      >
        <ArrowLeft className="size-3 rtl:rotate-180" /> Anasayfa
      </Link>

      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--muted)] mb-4">
          <Shield className="size-3.5 text-[var(--primary)]" />
          Gizlilik Politikası
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Veriniz, kontrolünüz altında
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Son güncelleme: {LAST_UPDATED}
        </p>
      </header>

      <p className="mb-8 text-sm leading-relaxed text-[var(--muted)]">
        <strong className="text-[var(--foreground)]">MeydanFest</strong> (
        &quot;biz&quot;, &quot;platform&quot;) olarak güvenini ciddiye alıyoruz.
        Bu politika, hizmetimizi kullandığında hangi verileri topladığımızı,
        bunları nasıl kullandığımızı ve haklarını sade bir Türkçeyle anlatır.
      </p>

      <Section title="1. Topladığımız veriler" icon={Database}>
        <ul className="space-y-2">
          <Item>
            <strong>Hesap bilgileri:</strong> Adın, e-posta adresin ve Google
            hesabından gelen profil fotoğrafın. Google ile giriş kullandığında
            sadece bu temel bilgiler alınır — şifrene asla erişimimiz olmaz.
          </Item>
          <Item>
            <strong>Konum (opsiyonel):</strong> Yakındaki etkinlikleri
            gösterebilmek için tarayıcının verdiği şehir bilgisini kullanırız.
            Hassas GPS koordinatlarını saklamayız.
          </Item>
          <Item>
            <strong>İçerik:</strong> Yazdığın yorumlar, mesajlar, yüklediğin
            etkinlik fotoğrafları, RSVP / check-in işaretlerin.
          </Item>
          <Item>
            <strong>Cihaz bilgileri:</strong> Tarayıcı türü, dil tercihi,
            yaklaşık IP konumu (Vercel altyapısı şehir bazında verir).
          </Item>
          <Item>
            <strong>Sosyal bağlantılar:</strong> Profilinde belirttiğin{" "}
            <Link href="/ayarlar/profil" className="text-[var(--primary)] hover:underline">
              Instagram kullanıcı adı
            </Link>{" "}
            sadece <strong>görünür</strong> olarak işaretlediğinde başkalarına
            gösterilir.
          </Item>
        </ul>
      </Section>

      <Section title="2. Verini nasıl kullanırız" icon={Eye}>
        <ul className="space-y-2">
          <Item>
            Sana uygun etkinlikleri, buddy önerilerini ve şehrindeki içerikleri
            göstermek için.
          </Item>
          <Item>
            Hatırlatıcılar göndermek (web push + e-posta) — RSVP&apos;li
            etkinliğinden 24 saat önce.
          </Item>
          <Item>
            Mesajlaşma, yorum yapma, etkinlik paylaşımı gibi temel işlevleri
            çalıştırmak için.
          </Item>
          <Item>
            <strong>Üçüncü taraflarla paylaşmayız.</strong> Ne reklam ağlarına,
            ne de veri brokerlarına. Tek istisna: yasal bir mahkeme kararı.
          </Item>
        </ul>
      </Section>

      <Section title="3. Kullandığımız altyapı sağlayıcıları" icon={Lock}>
        <p className="text-sm text-[var(--muted)] mb-3">
          Hizmetimizi çalıştırırken aşağıdaki güvenilir sağlayıcılarla
          çalışıyoruz. Hepsinin kendi gizlilik politikaları geçerlidir:
        </p>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          <Provider name="Vercel" purpose="Sunucu + CDN" />
          <Provider name="Google OAuth" purpose="Giriş" />
          <Provider name="Cloudflare R2" purpose="Fotoğraf saklama" />
          <Provider name="Anthropic Claude" purpose="AI özetleyici" />
          <Provider name="Resend" purpose="E-posta gönderimi" />
          <Provider name="iyzico" purpose="Ödeme (abonelik)" />
        </ul>
      </Section>

      <Section title="4. Çerezler" icon={Database}>
        <ul className="space-y-2">
          <Item>
            <code className="rounded bg-[var(--muted-bg)] px-1.5 py-0.5 text-xs">
              meydanfest_city
            </code>{" "}
            — şehir tercihin (30-365 gün)
          </Item>
          <Item>
            <code className="rounded bg-[var(--muted-bg)] px-1.5 py-0.5 text-xs">
              authjs.session-token
            </code>{" "}
            — oturum (giriş yaptığında)
          </Item>
          <Item>
            <code className="rounded bg-[var(--muted-bg)] px-1.5 py-0.5 text-xs">
              NEXT_LOCALE
            </code>{" "}
            — dil tercihin (1 yıl)
          </Item>
        </ul>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Üçüncü taraf takip çerezi (Google Analytics, Facebook Pixel vb.){" "}
          <strong className="text-[var(--foreground)]">kullanmıyoruz.</strong>
        </p>
      </Section>

      <Section title="5. Görünürlük tercihlerin" icon={Eye}>
        <ul className="space-y-2">
          <Item>
            Profil fotoğrafın, adın ve biyografin herkese açıktır — hesabını
            herkesin görebileceği gibi düşün.
          </Item>
          <Item>
            <strong>Instagram, e-posta ve telefon</strong> alanları
            varsayılan olarak <strong>gizlidir.</strong> Profil → Sosyal
            Bağlantılar&apos;dan tek tek görünür kılabilirsin.
          </Item>
          <Item>
            Yorumların, RSVP işaretlerin ve check-in&apos;lerin etkinlik
            sayfasında diğer kullanıcılara görünür.
          </Item>
          <Item>
            DM mesajlarına <strong>sadece sen ve karşı taraf</strong> erişebilir
            — sunucu logu tutmayız.
          </Item>
        </ul>
      </Section>

      <Section title="6. Haklarının" icon={Shield}>
        <ul className="space-y-2">
          <Item>
            <strong>Erişim:</strong> Hangi verilerimizin olduğunu sormak için
            bize yaz.
          </Item>
          <Item>
            <strong>Düzeltme:</strong> Profil ayarlarından her bilgini
            güncelleyebilirsin.
          </Item>
          <Item>
            <strong>Silme:</strong> Hesabını kalıcı olarak silmek istersen{" "}
            <a
              href="mailto:cengiz7karaaslan@gmail.com?subject=Hesap%20Silme%20Talebi"
              className="text-[var(--primary)] hover:underline"
            >
              bize mail at
            </a>{" "}
            — 7 gün içinde tüm verin silinir.
          </Item>
          <Item>
            <strong>Veri taşınabilirliği:</strong> Yıllık özet sayfandan
            etkinlik geçmişini indirilebilir formatta görebilirsin.
          </Item>
        </ul>
      </Section>

      <Section title="7. Çocuklar" icon={Shield}>
        <p className="text-sm text-[var(--muted)]">
          MeydanFest 13 yaş altı çocuklar için tasarlanmamıştır. Bir çocuğun
          hesap açtığını fark edersek hesabı sileriz.
        </p>
      </Section>

      <Section title="8. Politikadaki değişiklikler" icon={Mail}>
        <p className="text-sm text-[var(--muted)]">
          Önemli bir değişiklik olduğunda e-posta ile haber veririz veya
          giriş ekranında görünür bir uyarı koyarız.
        </p>
      </Section>

      <Section title="9. İletişim" icon={Mail}>
        <p className="text-sm text-[var(--muted)]">
          Soruların, talepleriniz veya endişelerin için bize{" "}
          <a
            href="mailto:cengiz7karaaslan@gmail.com"
            className="text-[var(--primary)] hover:underline"
          >
            cengiz7karaaslan@gmail.com
          </a>{" "}
          adresinden ulaşabilirsin. 7 iş günü içinde yanıtlamayı taahhüt
          ediyoruz.
        </p>
      </Section>

      {/* Hesap silme hızlı erişim */}
      <div className="mt-12 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-5">
        <div className="flex items-start gap-3">
          <Trash2 className="size-5 text-[var(--danger)] shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm">Hesabını silmek mi istiyorsun?</h3>
            <p className="text-xs text-[var(--muted)] mt-1">
              Tüm verin (mesajlar, yorumlar, RSVP&apos;ler, fotoğraflar) 7 gün
              içinde kalıcı olarak silinir.
            </p>
            <a
              href="mailto:cengiz7karaaslan@gmail.com?subject=Hesap%20Silme%20Talebi&body=MeydanFest%20hesab%C4%B1m%C4%B1%20silmek%20istiyorum."
              className="inline-flex items-center gap-1.5 mt-3 rounded-full bg-[var(--danger)]/10 hover:bg-[var(--danger)]/15 text-[var(--danger)] px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <Mail className="size-3.5" />
              Silme talebi gönder
            </a>
          </div>
        </div>
      </div>

      <p className="mt-10 text-center text-[11px] text-[var(--muted)]">
        Bu politika açık ve kolay anlaşılır olsun diye sade yazıldı. Hukuki
        teknik ayrıntılar için lütfen bize ulaş.
      </p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Shield;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
      <h2 className="mb-3 inline-flex items-center gap-2 text-base sm:text-lg font-bold">
        <Icon className="size-4 text-[var(--primary)]" />
        {title}
      </h2>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm leading-relaxed">
      <span className="text-[var(--primary)] mt-1">•</span>
      <span className="text-[var(--muted)]">{children}</span>
    </li>
  );
}

function Provider({ name, purpose }: { name: string; purpose: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] px-3 py-2">
      <div className="font-medium text-sm text-[var(--foreground)]">{name}</div>
      <div className="text-[11px] text-[var(--muted)]">{purpose}</div>
    </div>
  );
}
