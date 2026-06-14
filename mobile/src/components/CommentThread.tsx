import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Radius, Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapH, impactH } from "@/lib/haptics";
import { StoryAvatar } from "@/components/StoryAvatar";
import { MentionText } from "@/components/MentionText";
import { ReactionPicker } from "@/components/ReactionPicker";
import { commentRelTime, type ThreadComment } from "@/lib/commentThread";

interface Props {
  comments: ThreadComment[];
  myDeviceId: string;
  isAdmin?: boolean;
  /** Kendi yorumunu düzenleme penceresi (ms). 0 = düzenleme kapalı (feed). */
  editWindowMs?: number;
  onReact: (commentId: string, emoji: string) => void;
  onReply: (c: ThreadComment) => void;
  onDelete?: (c: ThreadComment) => void;
  onEdit?: (c: ThreadComment) => void;
}

/** Etkinlik + feed yorumlarını çizen paylaşılan bileşen: alıntı bloğu, emoji tepki,
 *  animasyonlu action-sheet (Alert YERİNE). Parent kaydırmayı sağlar (map render). */
export function CommentThread({ comments, myDeviceId, isAdmin, editWindowMs = 0, onReact, onReply, onDelete, onEdit }: Props) {
  const { t: T } = useTheme();
  const [active, setActive] = useState<ThreadComment | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const close = () => { setActive(null); setConfirmDel(false); };
  const open = (c: ThreadComment) => { impactH(); setActive(c); setConfirmDel(false); };

  const canEdit = (c: ThreadComment) =>
    !!onEdit && c.ownerDeviceId === myDeviceId && editWindowMs > 0 && Date.now() - new Date(c.createdAt).getTime() < editWindowMs;
  const canDelete = (c: ThreadComment) => !!onDelete && (c.ownerDeviceId === myDeviceId || !!isAdmin);

  // Düz yorum listesini ağaca çevir: kök yorumlar + altlarında (kronolojik) yanıtları.
  // Kök sırası gelen diziden korunur (çağıranın sıralaması geçerli kalsın); yanıtlar her
  // zaman eskiden yeniye sıralanır → yanıt artık ilgili yorumun ALTINDA, en üstte değil.
  const nodes = useMemo(() => {
    const byId = new Map(comments.map((c) => [c.id, c]));
    const ts = (s: string) => new Date(s).getTime() || 0;
    // Bir yorumun kök atasını bul (yanıt-zincirini yukarı takip et; döngüye karşı korumalı).
    const rootIdOf = (c: ThreadComment) => {
      let cur = c;
      const seen = new Set<string>();
      while (cur.replyTo && byId.has(cur.replyTo.id) && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = byId.get(cur.replyTo.id)!;
      }
      return cur.id;
    };
    const repliesByRoot = new Map<string, ThreadComment[]>();
    const roots: ThreadComment[] = [];
    for (const c of comments) {
      const isRoot = !c.replyTo || !byId.has(c.replyTo.id);
      const rid = isRoot ? c.id : rootIdOf(c);
      if (isRoot || rid === c.id) { roots.push(c); continue; }
      const arr = repliesByRoot.get(rid) ?? [];
      arr.push(c);
      repliesByRoot.set(rid, arr);
    }
    return roots.map((r) => ({
      comment: r,
      replies: (repliesByRoot.get(r.id) ?? []).sort((a, b) => ts(a.createdAt) - ts(b.createdAt)),
    }));
  }, [comments]);

  // Tek bir yorum satırı (kök ya da yanıt). isReply → biraz küçük avatar.
  const renderRow = (c: ThreadComment, i: number, isReply: boolean) => {
    const entries = Object.entries(c.reactions).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    return (
      <Animated.View key={c.id} entering={FadeInDown.duration(320).delay(Math.min(i, 8) * 30)}>
        <Pressable onLongPress={() => open(c)} delayLongPress={280} style={styles.row}>
          <StoryAvatar name={c.authorName} size={isReply ? 26 : 30} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[Type.label, { color: T.text }]} numberOfLines={1}>{c.authorName}</Text>
              <Text style={[Type.micro, { color: T.textFaint }]}>{commentRelTime(c.createdAt)}</Text>
            </View>

            {/* Alıntı bloğu (yanıtsa) — iç içe görünümde kime yanıt verdiğini netleştirir */}
            {c.replyTo ? (
              <View style={[styles.quote, { backgroundColor: T.surface, borderColor: T.hairline }]}>
                <View style={[styles.quoteBar, { backgroundColor: T.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[Type.micro, { color: T.primary, fontWeight: "700" }]} numberOfLines={1}>
                    ↩ {c.replyTo.authorName}
                  </Text>
                  <Text style={[Type.micro, { color: T.textDim }]} numberOfLines={1}>{c.replyTo.snippet}</Text>
                </View>
              </View>
            ) : null}

            <MentionText text={c.text} style={[Type.body, { color: T.textDim, marginTop: 2 }]} />

            {/* Aksiyon satırı: tepki çipi + Yanıtla + Tepki ekle */}
            <View style={styles.actions}>
              {entries.length ? (
                <Pressable onPress={() => open(c)} style={[styles.reactChip, { backgroundColor: T.surfaceStrong, borderColor: c.myReaction ? T.primary : T.hairline }]}>
                  <Text style={{ fontSize: 12.5 }}>{entries.slice(0, 3).map(([e]) => e).join("")} {c.reactionTotal}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => { tapH(); onReply(c); }} hitSlop={6}>
                <Text style={[Type.micro, { color: T.textFaint, fontWeight: "700" }]}>Yanıtla</Text>
              </Pressable>
              {!isReply && c.replyCount > 0 ? (
                <Text style={[Type.micro, { color: T.textFaint }]}>· {c.replyCount} yanıt</Text>
              ) : null}
              <Pressable onPress={() => open(c)} hitSlop={6} style={{ marginLeft: "auto" }}>
                <Text style={{ fontSize: 16 }}>👍</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={{ gap: 14 }}>
      {nodes.map(({ comment, replies }) => (
        <View key={comment.id} style={{ gap: 12 }}>
          {renderRow(comment, 0, false)}
          {replies.length ? (
            <View style={[styles.replyWrap, { borderLeftColor: T.hairline }]}>
              {replies.map((r, ri) => renderRow(r, ri, true))}
            </View>
          ) : null}
        </View>
      ))}

      {/* Animasyonlu action-sheet (Alert YERİNE) */}
      <Modal visible={!!active} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Animated.View entering={FadeInDown.duration(220)} style={{ width: "100%", alignItems: "center" }}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[styles.sheet, { backgroundColor: T.bgElevated, borderColor: T.hairline }]}
            >
              {active && confirmDel ? (
                <>
                  <Text style={[Type.body, { color: T.text, textAlign: "center", marginBottom: 14 }]}>Bu yorum silinsin mi?</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable onPress={() => { tapH(); setConfirmDel(false); }} style={[styles.btn, { flex: 1, backgroundColor: T.surfaceStrong }]}>
                      <Text style={[Type.body, { color: T.text, fontWeight: "600" }]}>Vazgeç</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { const c = active; close(); if (c) onDelete?.(c); }}
                      style={[styles.btn, { flex: 1, backgroundColor: "rgba(255,59,48,0.14)" }]}
                    >
                      <Text style={[Type.body, { color: "#FF3B30", fontWeight: "700" }]}>Sil</Text>
                    </Pressable>
                  </View>
                </>
              ) : active ? (
                <>
                  <View style={{ alignSelf: "center", marginBottom: 12 }}>
                    <ReactionPicker
                      myReaction={active.myReaction}
                      onPick={(emoji) => { const c = active; close(); if (c) onReact(c.id, emoji); }}
                    />
                  </View>
                  <Animated.View entering={FadeIn.delay(120)} style={{ gap: 8 }}>
                    <Pressable onPress={() => { const c = active; close(); if (c) onReply(c); }} style={[styles.actionRow, { backgroundColor: T.surface, borderColor: T.hairline }]}>
                      <Text style={[Type.body, { color: T.text }]}>↩︎  Yanıtla</Text>
                    </Pressable>
                    {canEdit(active) ? (
                      <Pressable onPress={() => { const c = active; close(); if (c) onEdit?.(c); }} style={[styles.actionRow, { backgroundColor: T.surface, borderColor: T.hairline }]}>
                        <Text style={[Type.body, { color: T.text }]}>✏️  Düzenle</Text>
                      </Pressable>
                    ) : null}
                    {canDelete(active) ? (
                      <Pressable onPress={() => { tapH(); setConfirmDel(true); }} style={[styles.actionRow, { backgroundColor: T.surface, borderColor: T.hairline }]}>
                        <Text style={[Type.body, { color: "#FF3B30" }]}>🗑️  Sil</Text>
                      </Pressable>
                    ) : null}
                  </Animated.View>
                </>
              ) : null}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  // Yanıtlar köke göre girintili + sol çizgili (ağaç hissi).
  replyWrap: { marginLeft: 18, paddingLeft: 14, borderLeftWidth: StyleSheet.hairlineWidth * 2, gap: 12 },
  quote: { flexDirection: "row", gap: 7, marginTop: 4, paddingVertical: 4, paddingRight: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth * 2, overflow: "hidden" },
  quoteBar: { width: 3, alignSelf: "stretch", borderRadius: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  reactChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 28 },
  sheet: { width: "100%", maxWidth: 380, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: 16 },
  actionRow: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  btn: { paddingVertical: 12, borderRadius: Radius.md, alignItems: "center" },
});
