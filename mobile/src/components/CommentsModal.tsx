import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
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
import { addComment, fetchComments, reactComment } from "@/lib/social";
import { fetchEventComments, postEventComment, reactEventComment } from "@/lib/eventComments";
import { getOrCreateDeviceId } from "@/lib/device";
import { useMentionField } from "@/lib/mentions";
import { MentionSuggestions } from "@/components/MentionSuggestions";
import { CommentThread } from "@/components/CommentThread";
import { KeyboardAvoider } from "@/components/KeyboardAvoider";
import { ReplyComposerBar } from "@/components/ReplyComposerBar";
import { postToThread, eventToThread, type ThreadComment } from "@/lib/commentThread";

interface Props {
  postId: string | null;
  authorName?: string;
  /** Yorumu yazan kullanıcının avatarı (event yorumunda denormalize saklanır). */
  authorAvatar?: string;
  /** Etkinlik (sistem) postu ise eventSlug — verilirse yorumlar EVENT-COMMENTS'ten okunur/yazılır
   *  (etkinlik detayıyla AYNI thread → feed ↔ detay yorumları birleşir). Yoksa feed (social) yorumları. */
  eventSlug?: string | null;
  onClose: () => void;
  /** Yorum eklenince kart sayacını güncellemek için. */
  onAdded?: (postId: string) => void;
}

/** Bir gönderinin yorumlarını listeler + emoji tepki, alıntı/yanıt, etkileşime göre sıralı. */
export function CommentsModal({ postId, authorName, authorAvatar, eventSlug, onClose, onAdded }: Props) {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const isEvent = !!eventSlug;
  const [items, setItems] = useState<ThreadComment[]>([]);
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

  const fetchAll = useCallback(async (): Promise<ThreadComment[]> => {
    if (isEvent && eventSlug) return (await fetchEventComments(eventSlug)).map(eventToThread);
    if (postId) return (await fetchComments(postId)).map(postToThread);
    return [];
  }, [isEvent, eventSlug, postId]);

  const reload = useCallback(async () => { setItems(await fetchAll()); }, [fetchAll]);

  useEffect(() => {
    if (postId || eventSlug) {
      setItems([]);
      setReplyTo(null);
      setLoading(true);
      fetchAll().then(setItems).finally(() => setLoading(false));
    }
  }, [postId, eventSlug, fetchAll]);

  const submit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || (!postId && !eventSlug)) return;
    setSending(true);
    try {
      let ok = false;
      if (isEvent && eventSlug) {
        ok = !!(await postEventComment({ eventSlug, authorName: authorName?.trim() || "", avatar: authorAvatar ?? null, text: trimmed, replyToId: replyTo?.id ?? null }));
      } else if (postId) {
        ok = !!(await addComment(postId, trimmed, authorName, replyTo?.id ?? null));
      }
      if (ok) {
        setText("");
        setReplyTo(null);
        mention.clear();
        await reload(); // etkileşim sıralaması için tazele
        if (postId) onAdded?.(postId);
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, isEvent, eventSlug, postId, authorName, replyTo, mention, reload, onAdded]);

  const onReact = useCallback(async (commentId: string, emoji: string) => {
    if (isEvent) await reactEventComment(commentId, emoji);
    else await reactComment(commentId, emoji);
    await reload();
  }, [isEvent, reload]);

  // Sıralama (Instagram gibi): En yeni / En beğenilen / En eski.
  const threads = useMemo(() => {
    const ts = (s: string) => new Date(s).getTime() || 0;
    const arr = [...items];
    if (sortBy === "new") arr.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
    else if (sortBy === "old") arr.sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
    else arr.sort((a, b) => (b.reactionTotal - a.reactionTotal) || (ts(b.createdAt) - ts(a.createdAt)));
    return arr;
  }, [items, sortBy]);

  return (
    <Modal visible={!!(postId || eventSlug)} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {/* TAM EKRAN — klavye input'u kapatmasın diye KeyboardAvoidingView ile input yukarı çıkar. */}
      <View style={[styles.full, { backgroundColor: T.bgElevated, paddingTop: insets.top + 4 }]}>
        <View style={[styles.header, { borderBottomColor: T.hairline }]}>
          <Text style={[Type.h2, { color: T.text }]}>
            Yorumlar{threads.length ? ` · ${threads.length}` : ""}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {threads.length > 1 ? (
              <Pressable
                onPress={() => { tapH(); setSortBy((s) => SORT_NEXT[s]); }}
                hitSlop={8}
                style={[styles.sortBtn, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}
              >
                <Text style={[Type.label, { color: T.text }]}>↕ {SORT_LABEL[sortBy]}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => { tapH(); onClose(); }} hitSlop={10}>
              <Text style={{ fontSize: 24, color: T.textDim }}>✕</Text>
            </Pressable>
          </View>
        </View>

        <KeyboardAvoider style={{ flex: 1 }} modal>
          {loading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={T.primary} />
            </View>
          ) : threads.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Text style={{ fontSize: 34 }}>💬</Text>
              <Text style={[Type.body, { color: T.textFaint }]}>İlk yorumu sen yaz!</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
              <CommentThread comments={threads} myDeviceId={myDeviceId} onReact={onReact} onReply={setReplyTo} />
            </ScrollView>
          )}

          {/* @mention önerileri (input'un üstünde) */}
          <View style={{ paddingHorizontal: 12 }}>
            <MentionSuggestions users={mention.results} onPick={mention.pick} />
          </View>
          {replyTo ? (
            <ReplyComposerBar authorName={replyTo.authorName} snippet={replyTo.text} onCancel={() => setReplyTo(null)} />
          ) : null}
          <View style={[styles.inputRow, { borderColor: T.hairline, paddingHorizontal: 16, paddingBottom: insets.bottom + 8 }]}>
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
        </KeyboardAvoider>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  sortBtn: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  input: { flex: 1, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100, ...Type.body },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
