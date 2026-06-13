import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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

const SCREEN_H = Dimensions.get("window").height;
type SortBy = "new" | "old" | "top";
const SORT_NEXT: Record<SortBy, SortBy> = { new: "top", top: "old", old: "new" };
const SORT_LABEL: Record<SortBy, string> = { new: "En yeni", top: "En beğenilen", old: "En eski" };
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
  const [sortBy, setSortBy] = useState<SortBy>("new");
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

  // Sıralama (Instagram gibi): En yeni / En beğenilen / En eski.
  const sortedComments = useMemo(() => {
    const ts = (s: string) => new Date(s).getTime() || 0;
    const arr = [...comments];
    if (sortBy === "new") arr.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
    else if (sortBy === "old") arr.sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
    else arr.sort((a, b) => (b.reactionTotal - a.reactionTotal) || (ts(b.createdAt) - ts(a.createdAt)));
    return arr;
  }, [comments, sortBy]);
  const threads = sortedComments.map(postToThread);

  return (
    <Modal visible={!!postId} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: T.bgElevated, borderColor: T.hairline, paddingBottom: insets.bottom + 10, height: SCREEN_H * 0.82 }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Tutamak — Instagram tarzı alt sayfa */}
          <View style={[styles.handle, { backgroundColor: T.hairline }]} />
          <View style={styles.header}>
            <Text style={[Type.h2, { color: T.text }]}>
              Yorumlar{comments.length ? ` · ${comments.length}` : ""}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {comments.length > 1 ? (
                <Pressable
                  onPress={() => { tapH(); setSortBy((s) => SORT_NEXT[s]); }}
                  hitSlop={8}
                  style={[styles.sortBtn, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}
                >
                  <Text style={[Type.label, { color: T.text }]}>↕ {SORT_LABEL[sortBy]}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => { tapH(); onClose(); }} hitSlop={10}>
                <Text style={{ fontSize: 22, color: T.textDim }}>✕</Text>
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={T.primary} />
            </View>
          ) : comments.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Text style={{ fontSize: 34 }}>💬</Text>
              <Text style={[Type.body, { color: T.textFaint }]}>İlk yorumu sen yaz!</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 4 }} keyboardShouldPersistTaps="handled">
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
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  sortBtn: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  input: { flex: 1, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100, ...Type.body },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
