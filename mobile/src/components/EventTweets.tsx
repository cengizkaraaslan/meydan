import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Radius, Type, glow } from "@/theme/aurora";
import { API_BASE } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { tapH } from "@/lib/haptics";

interface Tweet {
  id: string;
  text: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  likes?: number;
  url: string;
  createdAt?: string;
}

interface TweetsResponse {
  available: boolean;
  tweets: Tweet[];
  searchUrl?: string;
}

/** Tarihi kısa Türkçe biçimde (örn. "3 Haz") göster; geçersizse boş. */
function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/**
 * "𝕏'te bu etkinlik" bölümü — etkinlik başlığıyla X (Twitter) araması yapar.
 * available && tweet varsa kartları listeler; yoksa/hatada "𝕏'te ara" fallback butonu.
 */
export function EventTweets({ title }: { title: string }) {
  const { t: T } = useTheme();
  const [loading, setLoading] = useState(true);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [available, setAvailable] = useState(false);
  const [searchUrl, setSearchUrl] = useState<string | null>(null);

  // Fallback arama linki (API searchUrl vermezse).
  const fallbackUrl = `https://x.com/search?q=${encodeURIComponent(title)}&f=live`;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/event-tweets?q=${encodeURIComponent(title)}`);
        const json = (await res.json()) as TweetsResponse;
        if (!alive) return;
        setAvailable(!!json.available);
        setTweets(Array.isArray(json.tweets) ? json.tweets : []);
        setSearchUrl(json.searchUrl ?? null);
      } catch {
        if (!alive) return;
        setAvailable(false);
        setTweets([]);
        setSearchUrl(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [title]);

  const openSearch = () => {
    tapH();
    Linking.openURL(searchUrl || fallbackUrl);
  };

  const hasTweets = available && tweets.length > 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(300)}
      style={[styles.card, { backgroundColor: T.surface, borderColor: T.hairline }]}
    >
      <Text style={[Type.label, { color: T.textFaint, marginBottom: 4 }]}>𝕏'te bu etkinlik</Text>
      <Text style={[Type.body, { color: T.textDim, marginBottom: 14 }]}>
        Bu etkinlik 𝕏'te konuşuluyor mu?
      </Text>

      {loading ? (
        <View style={{ paddingVertical: 18, alignItems: "center" }}>
          <ActivityIndicator color={T.primary} />
        </View>
      ) : hasTweets ? (
        <View style={{ gap: 10 }}>
          {tweets.map((tw) => (
            <Pressable
              key={tw.id}
              onPress={() => {
                tapH();
                Linking.openURL(tw.url);
              }}
              style={[styles.tweet, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                {tw.authorAvatar ? (
                  <Image source={{ uri: tw.authorAvatar }} style={styles.avatar} contentFit="cover" transition={200} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: T.surface }]}>
                    <Text style={{ color: T.textDim, fontSize: 13, fontWeight: "800" }}>
                      {(tw.authorName?.charAt(0) || "?").toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[Type.label, { color: T.text }]} numberOfLines={1}>
                    {tw.authorName}
                  </Text>
                  {tw.authorHandle ? (
                    <Text style={[Type.micro, { color: T.textFaint }]} numberOfLines={1}>
                      @{tw.authorHandle.replace(/^@/, "")}
                    </Text>
                  ) : null}
                </View>
                {tw.createdAt ? (
                  <Text style={[Type.micro, { color: T.textFaint }]}>{shortDate(tw.createdAt)}</Text>
                ) : null}
              </View>
              <Text style={[Type.body, { color: T.text, lineHeight: 20 }]}>{tw.text}</Text>
              {typeof tw.likes === "number" ? (
                <Text style={[Type.micro, { color: T.textFaint, marginTop: 6 }]}>❤️ {tw.likes}</Text>
              ) : null}
            </Pressable>
          ))}
          <Pressable onPress={openSearch} style={[styles.searchBtn, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}>
            <Text style={[Type.label, { color: T.primary }]}>𝕏'te tümünü ara →</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={openSearch} style={[styles.searchBtn, { borderColor: T.primary, backgroundColor: T.surfaceStrong }]}>
          <Text style={[Type.label, { color: T.primary }]}>𝕏'te ara</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth * 2, ...glow("#000", 10, 0.2) },
  tweet: { borderRadius: Radius.md, padding: 12, borderWidth: StyleSheet.hairlineWidth * 2 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  searchBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: "center", justifyContent: "center" },
});
