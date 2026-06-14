import fs from "node:fs";
for (const line of fs.readFileSync(".env.scrape.local","utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if(!m) continue;
  let v=m[2]; if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1); if(!process.env[m[1]])process.env[m[1]]=v;
}
async function main(){
  const { db } = await import("../src/lib/db");
  const total = await db.event.count();
  const withEnd = await db.event.count({ where: { endsAt: { not: null } } });
  const futureWithEnd = await db.event.count({ where: { endsAt: { not: null }, startsAt: { gte: new Date() } } });
  console.log("Toplam etkinlik:", total);
  console.log("endsAt (bitiş tarihi) DOLU:", withEnd);
  console.log("...bunların gelecekte olanı:", futureWithEnd);
  const bySource = await db.event.groupBy({ by: ["source"], where: { endsAt: { not: null } }, _count: true });
  console.log("\nbitiş tarihli kaynak dağılımı:");
  bySource.sort((a,b)=>b._count-a._count).forEach(s=>console.log("  ",s.source,":",s._count));
  const samples = await db.event.findMany({ where: { endsAt: { not: null }, startsAt: { gte: new Date() } }, select: { title:true, city:true, source:true, startsAt:true, endsAt:true }, orderBy:{ startsAt:"asc" }, take: 10 });
  console.log("\nörnek (bitiş tarihli, gelecek):");
  samples.forEach(e=>console.log("  -",e.source,"|",e.title.slice(0,45),"|",e.startsAt.toLocaleDateString("tr-TR"),"→",e.endsAt?.toLocaleDateString("tr-TR")));
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1)});
