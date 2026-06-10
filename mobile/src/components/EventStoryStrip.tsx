import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Radius, Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { StoryAvatar } from "@/components/StoryAvatar";
import { PEOPLE, type Person } from "@/lib/people";
import type { StoryGroup } from "@/components/EventStoryViewer";

/** Basit deterministik hash (etkinlik id/slug → sabit sayı). Math.random YOK. */
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Bu etkinliğe story katkısı veren MOCK kişiler — etkinlik id/slug'a göre
 * DETERMİNİSTİK (her açılış aynı). Boyut 0–4 (bazı etkinliklerde 0 → boş durum).
 * hasStory'li kişiler tercih edilir.
 */
export function mockStoryContributors(seedKey: string): Person[] {
  const h = hashStr(seedKey);
  const count = h % 5; // 0..4
  if (count === 0) return [];
  // Önce halkalı (hasStory) kişiler, sonra diğerleri — deterministik döndürerek seç.
  const ringed = PEOPLE.filter((p) => p.hasStory);
  const rest = PEOPLE.filter((p) => !p.hasStory);
  const pool = [...ringed, ...rest];
  const start = h % pool.length;
  const out: Person[] = [];
  for (let i = 0; i < count && i < pool.length; i++) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}

/** Mock kişiyi tek-segment story grubuna çevirir (gerçek medya yoksa avatar tam ekran). */
export function personToGroup(p: Person): StoryGroup {
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    segments: [{ uri: p.avatar }],
  };
}

interface Props {
  /** Benim bu etkinliğe ait story grubum (varsa). */
  myGroup: StoryGroup | null;
  /** Deterministik mock katkıda bulunan grupları. */
  mockGroups: StoryGroup[];
  /** Bir gruba dokununca izleyiciyi o indeksten aç (tüm grup listesindeki indeks). */
  onOpen: (index: number) => void;
  /** "Story paylaş" akışını tetikle. */
  onShare: () => void;
  /** Story sunucuya yüklenirken: "+" butonunda + kendi avatarımda dönen loading. */
  uploading?: boolean;
}

/**
 * Etkinlik detayında yatay story şeridi: paylaş butonu + benim story'lerim +
 * mock katkıda bulunanlar. Hiç story yoksa "ilk story'yi sen paylaş" yer-tutucu.
 */
export function EventStoryStrip({ myGroup, mockGroups, onOpen, onShare, uploading }: Props) {
  const { t: T } = useTheme();
  const groups: StoryGroup[] = [...(myGroup ? [myGroup] : []), ...mockGroups];
  const empty = groups.length === 0;

  if (empty) {
    return (
      <Pressable
        onPress={onShare}
        disabled={uploading}
        style={{
          flexDirection: "row", alignItems: "center", gap: 14,
          padding: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: T.hairline,
          backgroundColor: T.surface,
        }}
      >
        <LinearGradient
          colors={T.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" }}
        >
          {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 24, color: "#fff" }}>＋</Text>}
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[Type.title, { color: T.text }]}>İlk story'yi sen paylaş ✨</Text>
          <Text style={[Type.label, { color: T.textFaint }]}>Bu anı paylaş, herkes görsün</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, paddingVertical: 2 }}
    >
      {/* Paylaş (kendi story'ni ekle) — yüklenirken loading */}
      <Pressable onPress={onShare} disabled={uploading} style={{ alignItems: "center", width: 68 }}>
        <View
          style={{
            width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center",
            borderWidth: 1, borderColor: T.hairline, backgroundColor: T.surfaceStrong,
          }}
        >
          {uploading ? <ActivityIndicator color={T.primary} size="small" /> : <Text style={{ fontSize: 26, color: T.primary }}>＋</Text>}
        </View>
        <Text style={[Type.micro, { color: T.textDim, marginTop: 4 }]} numberOfLines={1}>Paylaş</Text>
      </Pressable>

      {groups.map((g, i) => (
        <Pressable key={`${g.id}-${i}`} onPress={() => onOpen(i)} style={{ alignItems: "center", width: 72 }}>
          <View>
            <StoryAvatar uri={g.avatar} name={g.name} size={56} hasStory />
            {/* Kendi story'm yüklenirken avatar etrafında dönen loading halkası. */}
            {g.isMe && uploading ? (
              <View style={[StyleSheet.absoluteFill, styles.avatarUploading]} pointerEvents="none">
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : null}
          </View>
          <Text style={[Type.micro, { color: T.textDim, marginTop: 4 }]} numberOfLines={1}>
            {g.isMe ? "Sen" : g.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatarUploading: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
});
