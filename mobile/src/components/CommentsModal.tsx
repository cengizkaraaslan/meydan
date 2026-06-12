import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapH } from "@/lib/haptics";
import { addComment, fetchComments, reactComment, type PostComment } from "@/lib/social";
import { getOrCreateDeviceId } from "@/lib/device";
import { useMentionField } from "@/lib/mentions";
import { MentionSuggestions } from "@/components/MentionSuggestions";
import { CommentThread } from "@/components/CommentThread";
import { ReplyComposerBar } from "@/components/ReplyComposerBar";
import { postToThread, type ThreadComment } from "@/lib/commentThread";

interface Props {
  postId: string | null;
  authorName?: string;
  onClose: () => void;
  /** Yorum eklenince kart sayacını güncellemek için. */
  onAdded?: (postId: string) => void;
}

/** Bir gönderinin yorumlarını listeler + emoji tepki, alıntı/yanıt, etkileşime göre sıralı. */
export function CommentsModal({ postId, authorName, onClose, onAdded }: Props) {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ThreadComment | null>(null);
  const [myDeviceId, setMyDeviceId] = useState("");
  // @mention autocomplete: yorumda "@ad" yazınca kullanıcı önerisi.
  const mention = useMentionField(text, setText);

  useEffect(() => {
    getOrCreateDeviceId().then(setMyDeviceId).catch(() => {});
  }, []);

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
      setReplyTo(null);
      void load(postId);
    }
  }, [postId, load]);

  const submit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !postId || sending) return;
    setSending(true);
    try {
      const c = await addComment(postId, trimmed, authorName, replyTo?.id ?? null);
      if (c) {
        setText("");
        setReplyTo(null);
        mention.clear();
        setComments(await fetchComments(postId)); // etkileşim sıralaması için tazele
        onAdded?.(postId);
      }
    } finally {
      setSending(false);
    }
  }, [text, postId, sending, authorName, replyTo, mention, onAdded]);

  const onReact = useCallback(async (commentId: string, emoji: string) => {
    await reactComment(commentId, emoji);
    if (postId) setComments(await fetchComments(postId));
  }, [postId]);

  const threads = comments.map(postToThread);

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
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingVertical: 4 }} keyboardShouldPersistTaps="handled">
              <CommentThread comments={threads} myDeviceId={myDeviceId} onReact={onReact} onReply={setReplyTo} />
            </ScrollView>
          )}

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            {/* @mention önerileri (input'un üstünde) */}
            <View style={{ paddingHorizontal: 12 }}>
              <MentionSuggestions users={mention.results} onPick={mention.pick} />
            </View>
            {replyTo ? (
              <ReplyComposerBar authorName={replyTo.authorName} snippet={replyTo.text} onCancel={() => setReplyTo(null)} />
            ) : null}
            <View style={[styles.inputRow, { borderColor: T.hairline }]}>
              <TextInput
                value={text}
                onChangeText={mention.onChangeText}
                placeholder={replyTo ? `${replyTo.authorName}'e yanıt yaz… 😊` : "Yorum yaz… 😊"}
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
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  input: { flex: 1, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100, ...Type.body },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
