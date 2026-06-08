import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { EventRow } from "@/components/EventCard";
import { PostCard } from "@/components/PostCard";
import { CommentsModal } from "@/components/CommentsModal";
import { StoryViewer } from "@/components/StoryViewer";
import { StoryAvatar } from "@/components/StoryAvatar";
import { Loader, SectionHeader, EmptyState } from "@/ui/atoms";
import { Radius, Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapH, mediumH, successH } from "@/lib/haptics";
import { getOrCreateDeviceId } from "@/lib/device";
import { useStories } from "@/lib/stories";
import { PEOPLE, getPerson, type Person } from "@/lib/people";
import { fetchEvents, type ApiEvent } from "@/lib/api";
import {
  fetchFeed,
  fetchFollowing,
  followUser,
  followIdForPerson,
  createPost,
  reactPost,
  type FeedPost,
} from "@/lib/social";

type WallFilter = "all" | "follow";
const FILTER_KEY = "meydanfest:wallFilter";
/** Feed'de her N gönderide bir etkinlik serpiştir. */
const EVENT_EVERY = 4;

/** Kendi (yerel) story'lerini Person benzeri sanal profile çevirir → StoryViewer ile gösterilir. */
function myStoryPerson(uri: string): Person {
  return {
    id: "me",
    name: "Senin story'n",
    age: 0,
    city: "",
    distanceKm: 0,
    online: true,
    avatar: uri,
    bio: "",
    interests: [],
    gender: "other" as Person["gender"],
    hasStory: true,
  };
}

export default function MeydanScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { stories } = useStories();

  const [filter, setFilter] = useState<WallFilter>("all");
  const [filterReady, setFilterReady] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [compose, setCompose] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [storyPerson, setStoryPerson] = useState<Person | null>(null);

  useEffect(() => {
    void getOrCreateDeviceId().then(setDeviceId);
  }, []);

  // Son seçilen filtreyi yükle (yoksa "Genel").
  useEffect(() => {
    void AsyncStorage.getItem(FILTER_KEY).then((v) => {
      if (v === "follow" || v === "all") setFilter(v);
      setFilterReady(true);
    });
  }, []);

  const load = useCallback(async (f: WallFilter) => {
    try {
      const [feed, follow, ev] = await Promise.all([
        fetchFeed(f),
        fetchFollowing(),
        fetchEvents({ pageSize: 12 }).then((r) => r.data).catch(() => [] as ApiEvent[]),
      ]);
      setPosts(feed);
      setFollowing(follow);
      setEvents(ev);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Filtre hazır olunca + değişince yükle.
  useEffect(() => {
    if (!filterReady) return;
    setLoading(true);
    void load(filter);
  }, [filter, filterReady, load]);

  // Ekrana her dönüşte sessiz yenile (yeni gönderi/etkinlik görünsün).
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (!filterReady) return;
      if (firstFocus.current) { firstFocus.current = false; return; }
      void load(filter);
    }, [filter, filterReady, load]),
  );

  const changeFilter = useCallback((f: WallFilter) => {
    if (f === filter) return;
    tapH();
    setFilter(f);
    void AsyncStorage.setItem(FILTER_KEY, f);
  }, [filter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(filter);
  }, [filter, load]);

  // Story barı: kendi story'lerin + takip ettiğin (veya hasStory) kişiler.
  const followSet = useMemo(() => new Set(following), [following]);
  const storyPeople = useMemo(() => {
    return PEOPLE.filter((p) => p.hasStory && followSet.has(followIdForPerson(p.id)))
      .concat(PEOPLE.filter((p) => p.hasStory && !followSet.has(followIdForPerson(p.id))));
  }, [followSet]);

  const myStoryUri = stories[0]?.uri ?? null;

  // Reaksiyon: önce optimistik güncelle, sonra sunucu sonucuyla düzelt.
  const onReact = useCallback(async (postId: string, emoji: string) => {
    const next = await reactPost(postId, emoji);
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const reactions = { ...p.reactions };
        if (p.myReaction) reactions[p.myReaction] = Math.max(0, (reactions[p.myReaction] ?? 1) - 1);
        if (next) reactions[next] = (reactions[next] ?? 0) + 1;
        const reactionTotal = Object.values(reactions).reduce((a, b) => a + b, 0);
        return { ...p, reactions, myReaction: next, reactionTotal };
      }),
    );
  }, []);

  const onToggleFollow = useCallback(async (authorId: string) => {
    mediumH();
    setFollowing((prev) => [...prev, authorId]); // optimistik
    const r = await followUser(authorId);
    if (!r.following) setFollowing((prev) => prev.filter((id) => id !== authorId));
  }, []);

  const onComposeSend = useCallback(async () => {
    const trimmed = compose.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      const ok = await createPost({ text: trimmed });
      if (ok) {
        successH();
        setCompose("");
        setComposerOpen(false);
        await load(filter);
      }
    } finally {
      setPosting(false);
    }
  }, [compose, posting, filter, load]);

  const onCommentAdded = useCallback((postId: string) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)));
  }, []);

  // Gönderi + etkinlik serpiştirilmiş feed öğeleri.
  type FeedItem = { kind: "post"; post: FeedPost } | { kind: "event"; event: ApiEvent };
  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    let ei = 0;
    posts.forEach((post, i) => {
      items.push({ kind: "post", post });
      if ((i + 1) % EVENT_EVERY === 0 && ei < events.length) {
        items.push({ kind: "event", event: events[ei++] });
      }
    });
    // Hiç gönderi yoksa ama etkinlik varsa, en azından etkinlikleri göster.
    if (posts.length === 0 && events.length > 0) {
      events.slice(0, 6).forEach((event) => items.push({ kind: "event", event }));
    }
    return items;
  }, [posts, events]);

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        {/* Başlık + paylaş toggle */}
        <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[Type.h1, { color: T.text }]}>Meydan</Text>
            <Text style={[Type.label, { color: T.textFaint }]}>Topluluk duvarı</Text>
          </View>
          <Pressable
            onPress={() => { tapH(); setComposerOpen((v) => !v); }}
            style={[
              styles.composeToggle,
              composerOpen
                ? { backgroundColor: T.surfaceStrong, borderColor: T.hairline }
                : [{ backgroundColor: T.primary }, glow(T.primary, 12, 0.4)],
            ]}
            hitSlop={8}
          >
            <Text style={[styles.composeToggleIcon, { color: composerOpen ? T.textDim : "#fff" }]}>
              {composerOpen ? "×" : "+"}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Filtre — yazı tab (underline indicator) */}
        <View style={styles.filterRow}>
          {([
            { key: "all", label: "Genel" },
            { key: "follow", label: "Takip ettiklerim" },
          ] as { key: WallFilter; label: string }[]).map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => changeFilter(f.key)} style={styles.filterTab} hitSlop={8}>
                <Text
                  style={[
                    Type.title,
                    { color: active ? T.text : T.textFaint, fontWeight: active ? "800" : "600" },
                  ]}
                >
                  {f.label}
                </Text>
                {active ? (
                  <Animated.View
                    entering={FadeIn.duration(220)}
                    style={[styles.filterUnderline, { backgroundColor: T.primary }, glow(T.primary, 8, 0.5)]}
                  />
                ) : (
                  <View style={styles.filterUnderline} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Story barı */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storyBar}
          style={{ marginBottom: 16 }}
        >
          {/* Senin story'n */}
          <Pressable
            style={styles.storyItem}
            onPress={() => {
              tapH();
              if (myStoryUri) setStoryPerson(myStoryPerson(myStoryUri));
            }}
          >
            <View>
              <StoryAvatar uri={myStoryUri} name="Sen" size={58} hasStory={!!myStoryUri} />
              {!myStoryUri ? (
                <View style={[styles.plusBadge, { backgroundColor: T.primary, borderColor: T.bg }]}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>+</Text>
                </View>
              ) : null}
            </View>
            <Text style={[Type.micro, { color: T.textDim, maxWidth: 64 }]} numberOfLines={1}>
              Senin story'n
            </Text>
          </Pressable>

          {storyPeople.map((p) => (
            <Pressable key={p.id} style={styles.storyItem} onPress={() => { tapH(); setStoryPerson(getPerson(p.id) ?? p); }}>
              <StoryAvatar uri={p.avatar} name={p.name} size={58} hasStory online={p.online} />
              <Text style={[Type.micro, { color: T.textDim, maxWidth: 64 }]} numberOfLines={1}>{p.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Paylaş kutusu — varsayılan gizli, "+" ile açılır */}
        {composerOpen ? (
          <Animated.View
            entering={FadeInDown.duration(260)}
            style={[styles.composer, { backgroundColor: T.surface, borderColor: T.hairline }]}
          >
            <TextInput
              value={compose}
              onChangeText={setCompose}
              placeholder="Meydan'da ne paylaşmak istersin? 🎉"
              placeholderTextColor={T.textFaint}
              style={[styles.composeInput, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
              multiline
              autoFocus
            />
            <Pressable
              onPress={onComposeSend}
              disabled={!compose.trim() || posting}
              style={[styles.shareBtn, { backgroundColor: compose.trim() ? T.primary : T.surfaceStrong }, compose.trim() ? glow(T.primary, 10, 0.4) : undefined]}
            >
              {posting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[Type.label, { color: compose.trim() ? "#fff" : T.textFaint }]}>Paylaş</Text>
              )}
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Feed */}
        {loading ? (
          <Loader label="Yükleniyor…" />
        ) : feedItems.length === 0 ? (
          <EmptyState emoji="🌌" title="Henüz gönderi yok" sub="İlk paylaşan sen ol!" />
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 14, marginTop: 4 }}>
            <SectionHeader title={filter === "follow" ? "Takip ettiklerin" : "Akış"} accent={T.primary} />
            {feedItems.map((item, i) => (
              <Animated.View key={item.kind === "post" ? item.post.id : `ev-${item.event.id}-${i}`} entering={FadeInDown.delay(Math.min(i, 8) * 45).duration(380)}>
                {item.kind === "event" ? (
                  <View style={[styles.eventWrap, { borderColor: T.hairline }]}>
                    <Text style={[Type.label, { color: T.gold, marginBottom: 8 }]}>✨ Yeni etkinlik</Text>
                    <EventRow event={item.event} />
                  </View>
                ) : (
                  <PostCard
                    post={item.post}
                    isMine={!!deviceId && item.post.authorId === deviceId}
                    following={followSet.has(item.post.authorId)}
                    onReact={(emoji) => onReact(item.post.id, emoji)}
                    onOpenComments={() => setCommentsFor(item.post.id)}
                    onToggleFollow={() => onToggleFollow(item.post.authorId)}
                  />
                )}
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <CommentsModal postId={commentsFor} onClose={() => setCommentsFor(null)} onAdded={onCommentAdded} />
      <StoryViewer person={storyPerson} onClose={() => setStoryPerson(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, marginBottom: 14 },
  composeToggle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2, borderColor: "transparent" },
  composeToggleIcon: { fontSize: 26, fontWeight: "700", lineHeight: 30, marginTop: -2 },
  filterRow: { flexDirection: "row", gap: 22, paddingHorizontal: 16, marginBottom: 16 },
  filterTab: { alignItems: "center", gap: 6, paddingVertical: 4 },
  filterUnderline: { height: 3, borderRadius: 2, alignSelf: "stretch" },
  storyBar: { paddingHorizontal: 16, gap: 14, alignItems: "flex-start" },
  storyItem: { alignItems: "center", gap: 6, width: 72 },
  plusBadge: { position: "absolute", right: -2, bottom: 14, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  composer: { marginHorizontal: 16, marginBottom: 18, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: 12, gap: 10 },
  composeInput: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 10, minHeight: 46, maxHeight: 120, ...Type.body },
  shareBtn: { alignSelf: "flex-end", borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 10, minWidth: 90, alignItems: "center", justifyContent: "center" },
  eventWrap: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderStyle: "dashed", padding: 12 },
});
