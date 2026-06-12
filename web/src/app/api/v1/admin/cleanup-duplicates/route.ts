import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";
import { isAdminEmail } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/admin/cleanup-duplicates  body { email: <adminEmail>, dryRun?: boolean }
 * Mükerrer MobileProfile satırlarını temizler:
 *  1) AYNI e-postaya ait birden çok satırı TEK kanonik satıra (acct:<email> tercihli) indirir.
 *     Survivor'ın BOŞ alanları kopyadan doldurulur (veri kaybı yok). Aktivitesi (favori/swipe/
 *     katılım) olan kopya ASLA silinmez (atlanır, raporlanır).
 *  2) Test/boş satırları (diag/e2e pattern veya tamamen boş + aktivitesiz) siler.
 * Google hesaplarına (User) ve mock seed kişilerine (isFake) DOKUNMAZ.
 * Varsayılan dryRun=true → önce ne yapacağını döndürür; uygulamak için { dryRun:false }.
 */

const TEST_RE = /uuid-diag|profil-e2e|(^|[-_])(diag|e2e)([-_]|$)/i;

const FILL_FIELDS = ["name", "avatar", "gender", "city", "district", "lat", "lng", "lang", "birthDate", "pushToken"] as const;

type Prof = Awaited<ReturnType<typeof db.mobileProfile.findMany>>[number];

function richness(p: Prof): number {
  let s = 0;
  if (p.name) s += 4;
  if (p.avatar) s += 4;
  if (p.pushToken) s += 2;
  if (p.gender) s += 1;
  if (p.city) s += 1;
  if (p.birthDate) s += 1;
  return s;
}

export async function POST(request: NextRequest) {
  let body: { email?: string; dryRun?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  if (!(await isAdminEmail(body.email))) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  if (!isDbConfigured) {
    return NextResponse.json({ error: "Veritabanı yapılandırılmamış" }, { status: 503 });
  }
  const dryRun = body.dryRun !== false; // güvenli varsayılan

  try {
    const [profiles, favG, swG, attG] = await Promise.all([
      db.mobileProfile.findMany(),
      db.favorite.groupBy({ by: ["deviceId"], _count: { _all: true } }),
      db.swipe.groupBy({ by: ["swiperDeviceId"], _count: { _all: true } }),
      db.eventAttendance.groupBy({ by: ["deviceId"], _count: { _all: true } }),
    ]);
    const favBy = new Map(favG.map((g) => [g.deviceId, g._count._all]));
    const swBy = new Map(swG.map((g) => [g.swiperDeviceId, g._count._all]));
    const attBy = new Map(attG.map((g) => [g.deviceId, g._count._all]));
    const activity = (id: string) => (favBy.get(id) ?? 0) + (swBy.get(id) ?? 0) + (attBy.get(id) ?? 0);

    const toDelete = new Set<string>();
    const fillUpdates: { deviceId: string; data: Record<string, unknown> }[] = [];
    const merges: { survivor: string; removed: string[]; email: string }[] = [];
    const skippedHasActivity: string[] = [];

    // 1) E-postaya göre grupla (mock seed hariç) → birleştir.
    const byEmail = new Map<string, Prof[]>();
    for (const p of profiles) {
      if (p.isFake) continue;
      const e = p.email?.trim().toLowerCase();
      if (!e) continue;
      const arr = byEmail.get(e);
      if (arr) arr.push(p);
      else byEmail.set(e, [p]);
    }
    for (const [email, group] of byEmail) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => {
        const aAcct = a.deviceId.startsWith("acct:") ? 1 : 0;
        const bAcct = b.deviceId.startsWith("acct:") ? 1 : 0;
        if (aAcct !== bAcct) return bAcct - aAcct; // acct: tercih
        const r = richness(b) - richness(a);
        if (r) return r; // daha zengin
        return a.createdAt.getTime() - b.createdAt.getTime(); // en eski
      });
      const survivor = sorted[0];
      const fill: Record<string, unknown> = {};
      const removed: string[] = [];
      for (const dup of sorted.slice(1)) {
        for (const f of FILL_FIELDS) {
          if (survivor[f] == null && dup[f] != null && fill[f] == null) fill[f] = dup[f];
        }
        if (activity(dup.deviceId) > 0) {
          skippedHasActivity.push(dup.deviceId);
          continue;
        }
        toDelete.add(dup.deviceId);
        removed.push(dup.deviceId);
      }
      if (Object.keys(fill).length) fillUpdates.push({ deviceId: survivor.deviceId, data: fill });
      if (removed.length) merges.push({ survivor: survivor.deviceId, removed, email });
    }

    // 2) Test/boş satırlar (mock seed & aktif & birleştirmede korunan hariç).
    const junk: string[] = [];
    for (const p of profiles) {
      if (p.isFake || toDelete.has(p.deviceId)) continue;
      const empty = !p.name && !p.avatar && !p.email && !p.pushToken && !p.gender && !p.city;
      if ((TEST_RE.test(p.deviceId) || empty) && activity(p.deviceId) === 0) {
        toDelete.add(p.deviceId);
        junk.push(p.deviceId);
      }
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        summary: { mergeGroups: merges.length, willDelete: toDelete.size, willFill: fillUpdates.length, skippedHasActivity: skippedHasActivity.length },
        merges,
        junk,
        skippedHasActivity,
        willFill: fillUpdates,
      });
    }

    // Uygula: önce survivor'ları doldur, sonra kopyaları/çöpü sil.
    for (const u of fillUpdates) {
      await db.mobileProfile.update({ where: { deviceId: u.deviceId }, data: u.data });
    }
    const del = toDelete.size
      ? await db.mobileProfile.deleteMany({ where: { deviceId: { in: [...toDelete] } } })
      : { count: 0 };

    return NextResponse.json({
      ok: true,
      dryRun: false,
      merged: merges.length,
      filled: fillUpdates.length,
      deleted: del.count,
      skippedHasActivity,
      merges,
      junk,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB hatası" }, { status: 500 });
  }
}
