import fs from "node:fs";
for (const line of fs.readFileSync(".env.scrape.local","utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if(!m) continue;
  let v=m[2]; if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1); if(!process.env[m[1]])process.env[m[1]]=v;
}
async function main(){
  const { db } = await import("../src/lib/db");
  const rows = await db.event.findMany({ where: { title: { contains: "Pinokyo", mode: "insensitive" } }, select:{ title:true, category:true, source:true, city:true, startsAt:true, endsAt:true } });
  console.log("Pinokyo eşleşen:", rows.length);
  rows.forEach(r=>console.log("  -",JSON.stringify(r.category),"|",r.source,"|",r.title.slice(0,50),"| bitiş:",r.endsAt?"VAR":"yok"));
  // kategori dağılımı genel
  const byCat = await db.event.groupBy({ by:["category"], _count:true });
  console.log("\ngenel kategori dağılımı:");
  byCat.sort((a,b)=>b._count-a._count).forEach(c=>console.log("  ",JSON.stringify(c.category),":",c._count));
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1)});
