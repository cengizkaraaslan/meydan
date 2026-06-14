import * as cheerio from "cheerio";
const BASE="https://e-genc.gsb.gov.tr";
async function listPage(page:number, extra:Record<string,string>={}){
  const body=new URLSearchParams({ page:String(page), baslangic_tarihi:"", bitis_tarihi:"", il_id:"", ilce_id:"", faaliyet_ad:"", ...extra });
  const res=await fetch(`${BASE}/Faaliyet/_PostGetirFaaliyetListe`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","X-Requested-With":"XMLHttpRequest","User-Agent":"Mozilla/5.0","Referer":`${BASE}/Faaliyet?kurumTipEnum=Faaliyet`},body:body.toString()});
  const txt=await res.text();
  let j:any; try{j=JSON.parse(txt);}catch{ return {status:res.status, raw:txt.slice(0,200)}; }
  const $=cheerio.load(j.Result||"");
  const titles:string[]=[]; const urls:string[]=[];
  $("ul.offices_list > li a").each((_,a)=>{ titles.push($(a).find(".offices_list_bottom_title").text().replace(/\s+/g," ").trim()); urls.push($(a).attr("href")||""); });
  return { status:res.status, processStatus:j.ProcessStatus, count:titles.length, titles:titles.slice(0,3), firstUrl:urls[0] };
}
async function detailDate(url:string){
  const res=await fetch(url.startsWith("http")?url:BASE+url,{headers:{"User-Agent":"Mozilla/5.0"}});
  const $=cheerio.load(await res.text());
  const f:Record<string,string>={};
  $("li.list-group-item").each((_,li)=>{ const k=$(li).find("h6").text().replace(/\s+/g," ").trim().toLocaleLowerCase("tr"); const v=$(li).find("span.text-secondary").text().replace(/\s+/g," ").trim(); if(k)f[k]=v; });
  return { bas:f["başlangıç tarihi"], bit:f["bitiş tarihi"] };
}
async function main(){
  console.log("=== FİLTRESİZ sayfa1 ==="); const p1=await listPage(1); console.log(p1);
  if(p1.firstUrl) console.log("  ilk kart tarihi:", await detailDate(p1.firstUrl));
  console.log("\n=== baslangic_tarihi=13.06.2026 (bugün) sayfa1 ==="); const pf=await listPage(1,{baslangic_tarihi:"13.06.2026"}); console.log(pf);
  if(pf.firstUrl) console.log("  ilk kart tarihi:", await detailDate(pf.firstUrl));
  console.log("\n=== baslangic_tarihi=2026-06-13 (ISO) sayfa1 ==="); const pf2=await listPage(1,{baslangic_tarihi:"2026-06-13"}); console.log(pf2);
  console.log("\n=== yüksek sayfa (sayfa 500) filtresiz ==="); console.log(await listPage(500));
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1)});
