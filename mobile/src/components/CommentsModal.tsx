import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapH } from "@/lib/haptics";
import { StoryAvatar } from "@/components/StoryAvatar";
import { addComment, fetchComments, type PostComment } from "@/lib/social";
import { useMentionField } from "@/lib/mentions";
import { MentionSuggestions } from "@/components/MentionSuggestions";
import { MentionText } from "@/components/MentionText";

function relTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const m = Math.floor(Math.max(0, Date.now() - ts) / 60000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa`;
  return `${Math.floor(h / 24)} g`;
}

interface Props {
  postId: string | null;
  authorName?: string;
  onClose: () => void;
  /** Yorum eklenince kart sayacını güncellemek için. */
  onAdded?: (postId: string) => void;
}

/** Bir gönderinin yorumlarını listeler + emoji destekli yeni yorum ekler. */
export function CommentsModal({ postId, authorName, onClose, onAdded }: Props) {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // @mention autocomplete: yorumda "@ad" yazınca kullanıcı önerisi.
  const mention = useMentionField(text, setText);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setComments(await fetchComments(id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (postId) {
      setComments([]);
      void load(postId);
    }
  }, [postId, load]);

  const submit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !postId || sending) return;
    setSending(true);
    try {
      const c = await addComment(postId, trimmed, authorName);
      if (c) {
        setComments((prev) => [...prev, c]);
        setText("");
        mention.clear();
        onAdded?.(postId);
      }
    } finally {
      setSending(false);
    }
  }, [text, postId, sending, authorName, onAdded]);

  return (
    <Modal visible={!!postId} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: T.bgElevated, borderColor: T.hairline, paddingBottom: insets.bottom + 10 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[Type.h2, { color: T.text }]}>Yorumlar</Text>
            <Pressable onPress={() => { tapH(); onClose(); }} hitSlop={10}>
              <Text style={{ fontSize: 22, color: T.textDim }}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color={T.primary} />
            </View>
          ) : comments.length === 0 ? (
            <View style={{ paddingVertical: 36, alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 34 }}>💬</Text>
              <Text style={[Type.body, { color: T.textFaint }]}>İlk yorumu sen yaz!</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ gap: 14, paddingVertical: 4 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View style={styles.comment}>
                  <StoryAvatar name={item.authorName ?? "✦"} size={30} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[Type.label, { color: T.text }]} numberOfLines={1}>
                        {item.authorName?.trim() || "Meydanlı"}
                      </Text>
                      <Text style={[Type.micro, { color: T.textFaint }]}>{relTime(item.createdAt)}</Text>
                    </View>
                    <MentionText text={item.text} style={[Type.body, { color: T.textDim, marginTop: 2 }]} />
                  </View>
                </View>
              )}
            />
          )}

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            {/* @mention önerileri (input'un üstünde) */}
            <View style={{ paddingHorizontal: 12 }}>
              <MentionSuggestions users={mention.results} onPick={mention.pick} />
            </View>
            <View style={[styles.inputRow, { borderColor: T.hairline }]}>
              <TextInput
                value={text}
                onChangeText={mention.onChangeText}
                placeholder="Yorum yaz… 😊"
                placeholderTextColor={T.textFaint}
                style={[styles.input, { color: T.text, backgroundColor: T.surface, borderColor: T.hairline }]}
                multiline
              />
              <Pressable
                onPress={submit}
                disabled={!text.trim() || sending}
                style={[styles.sendBtn, { backgroundColor: text.trim() ? T.primary : T.surfaceStrong }]}
              >
                <Text style={{ color: text.trim() ? "#fff" : T.textFaint, fontWeight: "800" }}>➤</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    paddingHorizontal: 16, paddingTop: 14,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  comment: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  input: { flex: 1, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100, ...Type.body },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
