import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { EventRow } from "@/components/EventCard";
import { PostCard } from "@/components/PostCard";
import { CommentsModal } from "@/components/CommentsModal";
import { PostActionsModal } from "@/components/PostActionsModal";
import { StoryViewer } from "@/components/StoryViewer";
import { EventStoryViewer, type StoryGroup } from "@/components/EventStoryViewer";
import { StoryAvatar } from "@/components/StoryAvatar";
import { Loader, SectionHeader, EmptyState } from "@/ui/atoms";
import { Radius, Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapH, mediumH, successH, impactH } from "@/lib/haptics";
import { getOrCreateDeviceId } from "@/lib/device";
import { useStories, addStory } from "@/lib/stories";
import { useAuth } from "@/lib/auth";
import { PEOPLE, getPerson, type Person } from "@/lib/people";
import { fetchEvents, type ApiEvent } from "@/lib/api";
import {
  fetchFeed,
  fetchFollowing,
  followUser,
  followIdForPerson,
  createPost,
  reactPost,
  editPost,
  deletePost,
  FEED_PAGE,
  type FeedPost,
} from "@/lib/social";

type WallFilter = "all" | "follow";
const FILTER_KEY = "meydanfest:wallFilter";
const WALL_TIP_KEY = "meydanfest:wallTipSeen";
/** Kendi gönderiyi düzenle/sil penceresi (ms). */
const EDIT_WINDOW_MS = 10 * 60 * 1000;
/** Feed'de her N gönderide bir etkinlik serpiştir. */
const EVENT_EVERY = 4;

type FeedItem = { kind: "post"; post: FeedPost } | { kind: "event"; event: ApiEvent };

export default function MeydanScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { user } = useAuth();
  const { stories, reload: reloadStories, remove: removeStory } = useStories();
  // Profil avatarı (kendi story halkam için): "meydanfest:avatar" ?? user?.photo
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  // Kendi story'lerimi gerçek görselle gösteren izleyici (açıkken grup dolu).
  const [myStoryOpen, setMyStoryOpen] = useState(false);

  const [filter, setFilter] = useState<WallFilter>("all");
  const [filterReady, setFilterReady] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sayfalama durumu.
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const [compose, setCompose] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<FeedPost | null>(null);
  const [storyPerson, setStoryPerson] = useState<Person | null>(null);
  const [tipVisible, setTipVisible] = useState(false);
  // Kısa bilgi (hata) mesajı — tip modalını yeniden kullanır.
  const [tipMsg, setTipMsg] = useState<string | null>(null);

  useEffect(() => {
    void getOrCreateDeviceId().then(setDeviceId);
  }, []);

  // Kendi story halkam için profil avatarını yükle.
  useEffect(() => {
    void AsyncStorage.getItem("meydanfest:avatar").then((v) => setAvatarOverride(v ?? null));
  }, []);

  // Ekran her odaklandığında profil avatarını yeniden oku (profilde değişince burada da güncellensin).
  useFocusEffect(
    useCallback(() => {
      void AsyncStorage.getItem("meydanfest:avatar").then((v) => setAvatarOverride(v ?? null));
    }, []),
  );

  // Son seçilen filtreyi yükle (yoksa "Genel").
  useEffect(() => {
    void AsyncStorage.getItem(FILTER_KEY).then((v) => {
      if (v === "follow" || v === "all") setFilter(v);
      setFilterReady(true);
    });
  }, []);

  // İlk sayfa: gönderiler offset=0 + takip + etkinlikler.
  const load = useCallback(async (f: WallFilter) => {
    try {
      const [feed, follow, ev] = await Promise.all([
        fetchFeed(f, 0),
        fetchFollowing(),
        fetchEvents({ pageSize: 12 }).then((r) => r.data).catch(() => [] as ApiEvent[]),
      ]);
      setPosts(feed);
      setFollowing(follow);
      setEvents(ev);
      offsetRef.current = feed.length;
      setHasMore(feed.length >= FEED_PAGE);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Sonraki 20'yi çek ve listeye ekle.
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || loading || refreshing) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const next = await fetchFeed(filter, offsetRef.current);
      if (next.length > 0) {
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const merged = prev.concat(next.filter((p) => !seen.has(p.id)));
          offsetRef.current = merged.length;
          return merged;
        });
      }
      if (next.length < FEED_PAGE) setHasMore(false);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [filter, hasMore, loading, refreshing]);

  // Filtre hazır olunca + değişince ilk sayfayı yükle (offset sıfırla).
  useEffect(() => {
    if (!filterReady) return;
    setLoading(true);
    setHasMore(true);
    offsetRef.current = 0;
    void load(filter);
  }, [filter, filterReady, load]);

  // Ekrana her dönüşte sessiz yenile (yeni gönderi/etkinlik görünsün).
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (!filterReady) return;
      if (firstFocus.current) { firstFocus.current = false; return; }
      setHasMore(true);
      offsetRef.current = 0;
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
    setHasMore(true);
    offsetRef.current = 0;
    void load(filter);
  }, [filter, load]);

  // Story barı: kendi story'lerin + takip ettiğin (veya hasStory) kişiler.
  const followSet = useMemo(() => new Set(following), [following]);
  const storyPeople = useMemo(() => {
    return PEOPLE.filter((p) => p.hasStory && followSet.has(followIdForPerson(p.id)))
      .concat(PEOPLE.filter((p) => p.hasStory && !followSet.has(followIdForPerson(p.id))));
  }, [followSet]);

  const myStoryUri = stories[0]?.uri ?? null;
  // Hiç story var mı? (myStoryUri yok ve stories boş → "+" ekle butonu göster)
  const hasOwnStory = !!myStoryUri || stories.length > 0;
  // Story barı avatarı = profil avatarı (override ?? user.photo); story görseli değil.
  const myAvatar = avatarOverride || user?.photo || null;
  const myName = user?.name || "Sen";

  // Seçilen görseli kendi story'me ekle + şeridi yenile + onay.
  const addStoryFromUri = useCallback(
    async (uri: string) => {
      await addStory({ uri, caption: "", eventSlug: "", ts: Date.now() });
      reloadStories();
      successH();
    },
    [reloadStories],
  );

  // Kamera ile story çek.
  const shareFromCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Kamera izni gerekli", "Story çekmek için kamera iznine ihtiyaç var.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (res.canceled || !res.assets?.length) return;
    await addStoryFromUri(res.assets[0].uri);
  }, [addStoryFromUri]);

  // Galeriden story seç.
  const shareFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Galeri izni gerekli", "Story seçmek için galeri iznine ihtiyaç var.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (res.canceled || !res.assets?.length) return;
    await addStoryFromUri(res.assets[0].uri);
  }, [addStoryFromUri]);

  // Kamera rozeti / (story yokken) avatar → kaynak seç.
  const onShareStory = useCallback(() => {
    impactH();
    Alert.alert("Story paylaş", "Fotoğraf kaynağını seç", [
      { text: "📷 Kamera", onPress: () => { void shareFromCamera(); } },
      { text: "🖼️ Galeri", onPress: () => { void shareFromLibrary(); } },
      { text: "İptal", style: "cancel" },
    ]);
  }, [shareFromCamera, shareFromLibrary]);

  // Story varsa avatara dokun → kendi story'lerini gerçek görselle göster.
  const onOpenMyStory = useCallback(() => {
    tapH();
    if (myStoryUri) setMyStoryOpen(true);
    else onShareStory();
  }, [myStoryUri, onShareStory]);

  // Avatara uzun bas → silme menüsü (tek/çok story'e göre).
  const onLongPressMyStory = useCallback(() => {
    if (stories.length === 0) return;
    mediumH();
    if (stories.length === 1) {
      const ts = stories[0].ts;
      Alert.alert("Story", "Story'ni silmek istiyor musun?", [
        { text: "Vazgeç", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: () => { void removeStory(ts); } },
      ]);
    } else {
      const lastTs = stories[0].ts;
      Alert.alert("Story", `${stories.length} story'n var.`, [
        { text: "Vazgeç", style: "cancel" },
        { text: "En sonuncuyu sil", onPress: () => { void removeStory(lastTs); } },
        {
          text: "Tümünü sil",
          style: "destructive",
          onPress: async () => {
            for (const s of stories) await removeStory(s.ts);
          },
        },
      ]);
    }
  }, [stories, removeStory]);

  // Kendi story'lerim → EventStoryViewer için tek grup.
  const myStoryGroup = useMemo<StoryGroup>(
    () => ({
      id: "me",
      name: "Senin story'n",
      avatar: myAvatar ?? "",
      isMe: true,
      segments: stories.map((s) => ({ uri: s.uri, caption: s.caption })),
    }),
    [myAvatar, stories],
  );

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

  // İlk paylaşımdan sonra (1 kez) düzenle/sil ipucu göster.
  const maybeShowTip = useCallback(async () => {
    try {
      const seen = await AsyncStorage.getItem(WALL_TIP_KEY);
      if (seen === "1") return;
      await AsyncStorage.setItem(WALL_TIP_KEY, "1");
      setTipVisible(true);
    } catch {
      /* yoksay */
    }
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
        setHasMore(true);
        offsetRef.current = 0;
        await load(filter);
        void maybeShowTip();
      }
    } finally {
      setPosting(false);
    }
  }, [compose, posting, filter, load, maybeShowTip]);

  const onCommentAdded = useCallback((postId: string) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)));
  }, []);

  // Kendi gönderim mi + 10 dk içinde mi (düzenle/sil menüsü için).
  const canEditPost = useCallback(
    (post: FeedPost) =>
      !!deviceId &&
      post.authorId === deviceId &&
      Date.now() - new Date(post.createdAt).getTime() <= EDIT_WINDOW_MS,
    [deviceId],
  );

  // Düzenle → editPost → feed yenile (hata: kısa bilgi).
  const onEditPost = useCallback(
    async (id: string, text: string) => {
      setActionsFor(null);
      const r = await editPost(id, text);
      if (r.ok) {
        successH();
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));
      } else {
        setTipMsg(r.reason === "expired" ? "Düzenleme süresi (10 dk) doldu." : "Gönderi düzenlenemedi, tekrar dene.");
      }
    },
    [],
  );

  // Sil → deletePost → feed'den çıkar (hata: kısa bilgi).
  const onDeletePost = useCallback(
    async (id: string) => {
      setActionsFor(null);
      const r = await deletePost(id);
      if (r.ok) {
        successH();
        setPosts((prev) => {
          const merged = prev.filter((p) => p.id !== id);
          offsetRef.current = merged.length;
          return merged;
        });
      } else {
        setTipMsg(r.reason === "expired" ? "Silme süresi (10 dk) doldu." : "Gönderi silinemedi, tekrar dene.");
      }
    },
    [],
  );

  // Gönderi + etkinlik serpiştirilmiş feed öğeleri.
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

  const keyExtractor = useCallback(
    (item: FeedItem, i: number) => (item.kind === "post" ? item.post.id : `ev-${item.event.id}-${i}`),
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FeedItem; index: number }) => (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(380).springify()}>
        {item.kind === "event" ? (
          <View style={[styles.eventWrap, { borderColor: T.hairline }]}>
            <Text style={[Type.label, { color: T.gold, marginBottom: 8 }]}>✨ Yeni etkinlik</Text>
            <EventRow event={item.event} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            <PostCard
              post={item.post}
              isMine={!!deviceId && item.post.authorId === deviceId}
              following={followSet.has(item.post.authorId)}
              canEdit={canEditPost(item.post)}
              onReact={(emoji) => onReact(item.post.id, emoji)}
              onOpenComments={() => setCommentsFor(item.post.id)}
              onToggleFollow={() => onToggleFollow(item.post.authorId)}
              onOpenActions={() => setActionsFor(item.post)}
            />
          </View>
        )}
      </Animated.View>
    ),
    [T.hairline, T.gold, deviceId, followSet, canEditPost, onReact, onToggleFollow],
  );

  // Üst sabit içerik (başlık + filtre + story barı + composer) — FlatList header'ı.
  const ListHeader = (
    <>
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
        {/* Senin story'n — story yoksa "+" ekle butonu, varsa avatar+rozet */}
        {hasOwnStory ? (
          <Pressable
            style={styles.storyItem}
            onPress={onOpenMyStory}
            onLongPress={onLongPressMyStory}
            delayLongPress={350}
          >
            <View>
              <StoryAvatar uri={myAvatar} name={myName} size={58} hasStory={!!myStoryUri} />
              {/* Kamera rozeti: dokununca story paylaş (kamera/galeri). */}
              <Pressable
                onPress={onShareStory}
                hitSlop={8}
                style={[styles.camBadge, { backgroundColor: T.primary, borderColor: T.bg }]}
              >
                <Text style={{ fontSize: 11 }}>📷</Text>
              </Pressable>
            </View>
            <Text style={[Type.micro, { color: T.textDim, maxWidth: 64 }]} numberOfLines={1}>
              Senin story'n
            </Text>
          </Pressable>
        ) : (
          <Pressable style={styles.storyItem} onPress={onShareStory}>
            <View
              style={[styles.addStoryCircle, { backgroundColor: T.primary, borderColor: T.bg }, glow(T.primary, 12, 0.4)]}
            >
              <Text style={styles.addStoryPlus}>+</Text>
            </View>
            <Text style={[Type.micro, { color: T.textDim, maxWidth: 64, textAlign: "center" }]} numberOfLines={2}>
              Senin story'n{"\n"}Ekle
            </Text>
          </Pressable>
        )}

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

      {/* Akış başlığı */}
      {!loading && feedItems.length > 0 ? (
        <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
          <SectionHeader title={filter === "follow" ? "Takip ettiklerin" : "Akış"} accent={T.primary} />
        </View>
      ) : null}
    </>
  );

  const ListFooter = loadingMore ? (
    <View style={{ paddingVertical: 22 }}>
      <ActivityIndicator color={T.primary} />
    </View>
  ) : !hasMore && feedItems.length > 0 ? (
    <Text style={[Type.label, { color: T.textFaint, textAlign: "center", paddingVertical: 22 }]}>
      Hepsi yüklendi ✨
    </Text>
  ) : (
    <View style={{ height: 12 }} />
  );

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <FlatList
        data={loading ? [] : feedItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={loading ? null : ListFooter}
        ListEmptyComponent={
          loading ? (
            <Loader label="Yükleniyor…" />
          ) : (
            <EmptyState emoji="🌌" title="Henüz gönderi yok" sub="İlk paylaşan sen ol!" />
          )
        }
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 150 }}
        style={{ flex: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        onEndReachedThreshold={0.5}
        onEndReached={loadMore}
        removeClippedSubviews
        windowSize={9}
      />

      <CommentsModal postId={commentsFor} onClose={() => setCommentsFor(null)} onAdded={onCommentAdded} />
      <PostActionsModal
        postId={actionsFor?.id ?? null}
        initialText={actionsFor?.text ?? ""}
        onClose={() => setActionsFor(null)}
        onEdit={onEditPost}
        onDelete={onDeletePost}
      />
      <StoryViewer person={storyPerson} onClose={() => setStoryPerson(null)} />
      {/* Kendi story'lerim — gerçek görselle (çoklu segment). */}
      {myStoryOpen && stories.length > 0 ? (
        <EventStoryViewer
          groups={[myStoryGroup]}
          startIndex={0}
          onClose={() => setMyStoryOpen(false)}
          onDeleteSegment={(_gi, si) => {
            // Tek grup (kendi story'm) → si ile ilgili story'yi kalıcı sil, şeridi yenile, viewer'ı kapat.
            const target = stories[si];
            if (target) void removeStory(target.ts);
            reloadStories();
            setMyStoryOpen(false);
          }}
        />
      ) : null}

      {/* İlk paylaşım ipucu (1 kez) + hata bilgisi — solid arka plan, okunaklı. */}
      <TipModal
        visible={tipVisible || !!tipMsg}
        title={tipMsg ? "Bilgi" : "💡 İpucu"}
        body={tipMsg ?? "Paylaştığın gönderiyi 10 dakika içinde düzenleyebilir veya silebilirsin."}
        onClose={() => { tapH(); setTipVisible(false); setTipMsg(null); }}
        T={T}
      />
    </View>
  );
}

/** Solid arka planlı küçük bilgi/ipucu modalı. */
function TipModal({
  visible,
  title,
  body,
  onClose,
  T,
}: {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
  T: ReturnType<typeof useTheme>["t"];
}) {
  if (!visible) return null;
  return (
    <View style={styles.tipScrim} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        entering={FadeInDown.duration(240).springify()}
        style={[styles.tipCard, { backgroundColor: T.bgElevated, borderColor: T.hairline }, glow("#000", 20, 0.35)]}
      >
        <Text style={[Type.title, { color: T.text, marginBottom: 8 }]}>{title}</Text>
        <Text style={[Type.body, { color: T.textDim, marginBottom: 16 }]}>{body}</Text>
        <Pressable
          onPress={onClose}
          style={[styles.tipBtn, { backgroundColor: T.primary }, glow(T.primary, 10, 0.4)]}
        >
          <Text style={[Type.label, { color: "#fff" }]}>Anladım</Text>
        </Pressable>
      </Animated.View>
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
  camBadge: { position: "absolute", right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  addStoryCircle: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  addStoryPlus: { color: "#fff", fontSize: 34, fontWeight: "700", lineHeight: 38, marginTop: -2 },
  composer: { marginHorizontal: 16, marginBottom: 18, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: 12, gap: 10 },
  composeInput: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 10, minHeight: 46, maxHeight: 120, ...Type.body },
  shareBtn: { alignSelf: "flex-end", borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 10, minWidth: 90, alignItems: "center", justifyContent: "center" },
  eventWrap: { marginHorizontal: 16, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderStyle: "dashed", padding: 12 },
  tipScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 28 },
  tipCard: { width: "100%", maxWidth: 360, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: 20 },
  tipBtn: { alignSelf: "flex-end", borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
});
