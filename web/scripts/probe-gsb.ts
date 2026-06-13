import fs from "node:fs";
for (const line of fs.readFileSync(".env.scrape.local","utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if(!m) continue;
  let v=m[2]; if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1); if(!process.env[m[1]])process.env[m[1]]=v;
}
process.env.USE_MOCK_DATA="false";
async function main(){
  const { GsbGencOfisScraper } = await import("../src/lib/scrapers/providers/GsbGencOfisScraper");
  const { guessCategory } = await import("../src/lib/scrapers/parse-helpers");
  const s = new GsbGencOfisScraper();
  const r = await s.run({ maxItems: 60 } as any);
  console.log("GSB toplam:", r.events.length);
  const cats: Record<string,number> = {};
  for(const e of r.events){ cats[e.category]=(cats[e.category]||0)+1; }
  console.log("kategori dağılımı:", cats);
  const fest = r.events.filter(e=>/festival|şenlik|senlik|fest\b/i.test(e.title));
  console.log("\nfestival/şenlik içeren başlıklar ("+fest.length+"):");
  fest.slice(0,20).forEach(e=>console.log("  -",e.category,"|",e.title,"| bitiş:", e.endsAt?.toLocaleDateString("tr-TR")||"yok"));
  console.log("\nilk 15 başlık (genel):");
  r.events.slice(0,15).forEach(e=>console.log("  -",e.category,"|",e.title));
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1)});
