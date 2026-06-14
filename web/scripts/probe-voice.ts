import fs from "node:fs";
for (const line of fs.readFileSync(".env.scrape.local","utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if(!m) continue;
  let v=m[2]; if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1); if(!process.env[m[1]])process.env[m[1]]=v;
}
async function main(){
  const { db } = await import("../src/lib/db");
  // Message tablosu — text "[voice]..." içerenler
  const rows:any[] = await db.mobileMessage.findMany({ where: { text: { startsWith: "[voice]" } }, select: { id:true, text:true, createdAt:true }, orderBy:{ createdAt:"desc" }, take: 5 }).catch((e:any)=>{console.log("message sorgu hatası:",e.message);return [];});
  console.log("[voice] mesaj sayısı (son 5):", rows.length);
  for(const r of rows){
    const rest = r.text.slice("[voice]".length);
    const ci = rest.indexOf(":");
    const sec = ci>0?rest.slice(0,ci):"?";
    const url = ci>0?rest.slice(ci+1):rest;
    console.log("\n  id:", r.id, "| süre:", sec, "sn |", r.createdAt.toISOString());
    console.log("  URL:", url);
    try{
      const res = await fetch(url, { method:"GET" });
      const buf = Buffer.from(await res.arrayBuffer());
      console.log("  → HTTP", res.status, "| content-type:", res.headers.get("content-type"), "| boyut:", buf.length, "bayt");
    }catch(e:any){ console.log("  → ERİŞİM HATASI:", e.message); }
  }
  const total = await db.mobileMessage.count({ where: { text: { startsWith: "[voice]" } } });
  console.log("\nToplam [voice] mesaj:", total);
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1)});
