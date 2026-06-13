import "server-only";

/**
 * Expo push gönderimi (mobil cihazlar). `expo-server-sdk` yerine doğrudan Expo
 * push HTTP API'sine fetch ile gider → ekstra bağımlılık yok.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Instagram tarzı bildirim görseli (gönderenin avatarı). Expo `richContent.image`. */
  image?: string;
}

/** Geçerli bir Expo push token'ı mı (ExponentPushToken[...] / ExpoPushToken[...]). */
export function isExpoPushToken(token: string | null | undefined): token is string {
  return !!token && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
}

/**
 * Mesajları Expo'ya gönderir (100'lük batch'ler). Sonuçta artık geçersiz olan
 * (DeviceNotRegistered) token'ları döndürür → arayan DB'den temizleyebilir.
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<{ invalidTokens: string[] }> {
  const valid = messages.filter((m) => isExpoPushToken(m.to));
  const invalidTokens: string[] = [];
  if (valid.length === 0) return { invalidTokens };

  for (let i = 0; i < valid.length; i += 100) {
    const batch = valid.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(
          batch.map((m) => ({
            to: m.to,
            title: m.title,
            body: m.body,
            data: m.data ?? {},
            sound: "default",
            channelId: "mentions",
            priority: "high",
            // Gönderenin avatarı → bildirimde görsel (iOS sağda thumbnail, Android büyük resim).
            ...(m.image ? { richContent: { image: m.image } } : {}),
          })),
        ),
      });
      const json = (await res.json()) as {
        data?: { status: string; details?: { error?: string } }[];
      };
      const tickets = json.data ?? [];
      tickets.forEach((tk, idx) => {
        if (tk.status === "error" && tk.details?.error === "DeviceNotRegistered") {
          invalidTokens.push(batch[idx].to);
        }
      });
    } catch (e) {
      console.warn("[expo-push] gönderim hatası:", e instanceof Error ? e.message : e);
    }
  }
  return { invalidTokens };
}
