import type { Metadata } from "next";
import { cookies } from "next/headers";
import { GraduationCap } from "lucide-react";
import { getCourseGroups, courseSlug } from "@/lib/courses";
import { PageFade } from "@/components/motion/PageFade";
import { CoursesExplorer } from "@/components/CoursesExplorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ücretsiz Kurslar — Belediye Meslek & Sanat Eğitimleri",
  description:
    "Eskişehir (ESMEK), Konya (KOMEK), Gaziantep (GASMEK), İzmir (İZMEK), Kayseri (KAYMEK) belediyelerinin ücretsiz kurs ve atölye branşları, ön kayıt bağlantılarıyla.",
};

export default async function CoursesPage() {
  const raw = await getCourseGroups();
  // Branşı olanları öne al; her kursa kararlı slug ekle (client'a slug'lı geçer).
  const groups = raw
    .map((g) => ({
      provider: {
        key: g.provider.key,
        name: g.provider.name,
        city: g.provider.city,
        registerUrl: g.provider.registerUrl,
        national: g.provider.national,
      },
      courses: g.courses.map((c) => ({ ...c, slug: courseSlug(g.provider.key, c.name, c.center) })),
    }))
    .sort((a, b) => b.courses.length - a.courses.length);

  const totalCourses = groups.reduce((s, g) => s + g.courses.length, 0);

  // Kullanıcının şehri (cookie) — o şehirde kurs varsa varsayılan filtre olsun.
  // Ulusal kaynaklarda (İŞKUR) kurs-başına şehri de hesaba kat.
  const cookieCity = (await cookies()).get("meydanfest_city")?.value;
  const citiesWithCourses = new Set<string>();
  for (const g of groups) {
    if (g.courses.length === 0) continue;
    if (g.provider.national) {
      for (const c of g.courses) if (c.city) citiesWithCourses.add(c.city);
    } else {
      citiesWithCourses.add(g.provider.city);
    }
  }
  const defaultCity = cookieCity && citiesWithCourses.has(cookieCity) ? cookieCity : "";

  return (
    <PageFade className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] px-3 py-1 text-xs font-semibold mb-3">
          <GraduationCap className="size-3.5" /> Ücretsiz
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Ücretsiz Kurslar</h1>
        <p className="mt-2 text-[var(--muted)] max-w-2xl">
          Belediyelerin meslek ve sanat edindirme kursları (ESMEK, KOMEK, GASMEK, İZMEK, KAYMEK).
          Branş ara, şehre göre süz, branşa tıklayıp katıl & yorum yaz.
          {totalCourses > 0 && <> Şu an <strong className="text-[var(--foreground)]">{totalCourses}</strong> branş.</>}
        </p>
      </div>

      <CoursesExplorer groups={groups} defaultCity={defaultCity} />
    </PageFade>
  );
}
