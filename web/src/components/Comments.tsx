"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Heart, LogIn, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { EmojiPicker } from "./EmojiPicker";
import { ReportButton } from "./ReportButton";
import { playSendSound, playClick } from "@/lib/sounds";
import {
  addCommentAction,
  deleteCommentAction,
  listCommentsAction,
  toggleLikeAction,
} from "@/lib/comments-actions";
import type { SerializedComment } from "@/lib/comments-store";

interface CommentsProps {
  slug?: string;
  isLoggedIn?: boolean;
  authorName?: string | null;
  viewerUsername?: string | null;
  initialItems?: SerializedComment[];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes}dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}sa önce`;
  return `${Math.floor(hours / 24)}g önce`;
}

interface CommentNode extends SerializedComment {
  replies: CommentNode[];
}

function buildTree(items: SerializedComment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  items.forEach((c) => byId.set(c.id, { ...c, replies: [] }));
  const roots: CommentNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  for (const node of byId.values()) {
    node.replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return roots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function Comments({ slug, isLoggedIn = false, authorName = null, viewerUsername = null, initialItems }: CommentsProps = {}) {
  const t = useTranslations("event");
  const [items, setItems] = useState<SerializedComment[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!initialItems);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!slug || initialItems) return;
    setLoading(true);
    listCommentsAction(slug)
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, [slug, initialItems]);

  const tree = useMemo(() => buildTree(items), [items]);

  function insertEmoji(emoji: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setText((p) => p + emoji);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function submit() {
    if (!isLoggedIn || !slug) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    // Optimistic: yorumu sunucu yanıtını beklemeden anında göster (SQLite gibi
    // "yerelde anında" his). Geçici id ile ekle; sunucu dönünce gerçek kayıtla
    // değiştir, hata olursa geri al.
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const replySnapshot = replyTo;
    const optimistic: SerializedComment = {
      id: tempId,
      authorUsername: viewerUsername ?? "anon",
      authorName: authorName?.trim() || "Sen",
      authorColor: "#6366f1",
      text: trimmed,
      createdAt: new Date().toISOString(),
      parentId: replySnapshot?.id ?? null,
      likeCount: 0,
      likedByMe: false,
    };
    setItems((prev) => [...prev, optimistic]);
    setText("");
    setReplyTo(null);
    playSendSound();

    startTransition(async () => {
      const res = await addCommentAction(slug, trimmed, replySnapshot?.id ?? null);
      if (!res.ok || !res.comment) {
        // Geri al: geçici yorumu kaldır, metni kullanıcıya geri ver.
        setItems((prev) => prev.filter((c) => c.id !== tempId));
        setText((cur) => cur || trimmed);
        setReplyTo((cur) => cur ?? replySnapshot);
        toast.error(res.error ?? "Yorum gönderilemedi");
        return;
      }
      // Sunucu kaydıyla uzlaştır (gerçek id, createdAt vb.).
      setItems((prev) => prev.map((c) => (c.id === tempId ? res.comment! : c)));
      toast.success(replySnapshot ? "Cevabın yayınlandı" : "Yorumun yayınlandı");
    });
  }

  function handleDelete(commentId: string) {
    if (!slug) return;
    if (!window.confirm("Yorumun silinsin mi?")) return;

    // Optimistic: yorumu (ve altındaki cevap zincirini) anında kaldır; hata olursa
    // önceki listeyi geri yükle.
    const toRemove = new Set<string>([commentId]);
    let added = true;
    while (added) {
      added = false;
      for (const c of items) {
        if (c.parentId && toRemove.has(c.parentId) && !toRemove.has(c.id)) {
          toRemove.add(c.id);
          added = true;
        }
      }
    }
    const snapshot = items;
    setItems((prev) => prev.filter((c) => !toRemove.has(c.id)));

    startTransition(async () => {
      const res = await deleteCommentAction(slug, commentId);
      if (!res.ok) {
        setItems(snapshot);
        toast.error(res.error ?? "Yorum silinemedi");
      }
    });
  }

  function handleLike(commentId: string) {
    if (!isLoggedIn || !slug) {
      toast.error("Beğenmek için giriş yapmalısın");
      return;
    }
    // Optimistic
    setItems((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const liked = !c.likedByMe;
        if (liked) playClick();
        return {
          ...c,
          likedByMe: liked,
          likeCount: c.likeCount + (liked ? 1 : -1),
        };
      }),
    );
    startTransition(async () => {
      const res = await toggleLikeAction(slug, commentId);
      if (!res.ok || !res.comment) {
        toast.error(res.error ?? "Beğenilemedi");
        // revert
        setItems((prev) =>
          prev.map((c) => {
            if (c.id !== commentId) return c;
            const liked = !c.likedByMe;
            return {
              ...c,
              likedByMe: liked,
              likeCount: c.likeCount + (liked ? 1 : -1),
            };
          }),
        );
        return;
      }
      // Reconcile with server
      setItems((prev) => prev.map((c) => (c.id === commentId ? res.comment! : c)));
    });
  }

  function startReply(node: CommentNode) {
    if (!isLoggedIn) {
      toast.error("Cevap vermek için giriş yapmalısın");
      return;
    }
    setReplyTo({ id: node.id, name: node.authorName });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <MessageCircle className="size-4 text-[var(--primary)]" />
        {t("comments_title")}
        <span className="text-xs font-normal text-[var(--muted)]">({items.length})</span>
      </h3>

      {isLoggedIn ? (
        <div className="mb-5">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-[var(--muted-bg)] px-3 py-1.5 text-xs">
              <span>
                <span className="text-[var(--muted)]">Cevaplıyorsun:</span>{" "}
                <strong>{replyTo.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Vazgeç
              </button>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? `${replyTo.name} kullanıcısına cevap yaz...` : t("comment_placeholder")}
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-colors"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <EmojiPicker onSelect={insertEmoji} />
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim() || pending}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-1.5 text-sm font-medium hover:opacity-95 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send className="size-3.5 rtl:rotate-180" />
              {replyTo ? "Cevapla" : t("comment_send")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted-bg)] px-4 py-3">
          <div className="flex-1 text-sm text-[var(--muted)]">
            Yorum yazmak için <span className="font-medium text-[var(--foreground)]">giriş yapmalısın</span>.
          </div>
          <Link
            href="/giris"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-1.5 text-sm font-semibold hover:opacity-95 transition-opacity"
          >
            <LogIn className="size-3.5" />
            Giriş yap
          </Link>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Yorumlar yükleniyor...</div>
      ) : tree.length === 0 ? (
        <div className="text-sm text-[var(--muted)]">Henüz yorum yok. İlk yorumu sen yap!</div>
      ) : (
        <ul className="space-y-5">
          <AnimatePresence initial={false}>
            {tree.map((node) => (
              <CommentItem
                key={node.id}
                node={node}
                depth={0}
                onLike={handleLike}
                onReply={startReply}
                onDelete={handleDelete}
                slug={slug}
                isLoggedIn={isLoggedIn}
                viewerUsername={viewerUsername}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

interface ItemProps {
  node: CommentNode;
  depth: number;
  onLike: (id: string) => void;
  onReply: (n: CommentNode) => void;
  onDelete: (id: string) => void;
  slug?: string;
  isLoggedIn?: boolean;
  viewerUsername?: string | null;
}

function CommentItem({ node, depth, onLike, onReply, onDelete, slug, isLoggedIn = false, viewerUsername = null }: ItemProps) {
  const isOwnComment =
    !!viewerUsername &&
    (viewerUsername === node.authorUsername ||
      viewerUsername.toLowerCase() === node.authorUsername.toLowerCase());
  return (
    <motion.li
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={depth > 0 ? "ms-10 sm:ms-12" : ""}
    >
      <div className="flex gap-3">
        <span
          className="grid size-9 place-items-center rounded-full text-white text-sm font-semibold shrink-0"
          style={{ background: node.authorColor }}
        >
          {node.authorName.charAt(0)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium">{node.authorName}</span>
            <span className="text-xs text-[var(--muted)]">@{node.authorUsername.split("@")[0]}</span>
            <span className="text-xs text-[var(--muted)]">• {relativeTime(node.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words">
            {node.text}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => onLike(node.id)}
              className={`inline-flex items-center gap-1 transition-colors ${
                node.likedByMe
                  ? "text-[var(--primary)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Heart
                className={`size-3.5 ${node.likedByMe ? "fill-current" : ""}`}
              />
              {node.likeCount > 0 ? node.likeCount : ""}
            </button>
            {depth < 2 && (
              <button
                type="button"
                onClick={() => onReply(node)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cevapla
              </button>
            )}
            {!isOwnComment && (
              <ReportButton
                target="comment"
                targetId={node.id}
                targetExcerpt={node.text}
                targetContext={slug}
                isLoggedIn={isLoggedIn}
                variant="text"
              />
            )}
            {isOwnComment && !node.id.startsWith("tmp-") && (
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                className="text-[var(--muted)] hover:text-red-500 transition-colors"
              >
                Sil
              </button>
            )}
          </div>
        </div>
      </div>
      {node.replies.length > 0 && (
        <ul className="mt-4 space-y-4">
          {node.replies.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onLike={onLike}
              onReply={onReply}
              onDelete={onDelete}
              slug={slug}
              isLoggedIn={isLoggedIn}
              viewerUsername={viewerUsername}
            />
          ))}
        </ul>
      )}
    </motion.li>
  );
}
