const E='cengiz7karaaslan@gmail.com';
const BASE='https://etkinlikscout.vercel.app/api/v1/admin/scrapers';
(async()=>{
  const list=await (await fetch(BASE+'?email='+encodeURIComponent(E))).json();
  const sources=(list.scrapers||[]).map(s=>s.source);
  console.log('toplam kaynak:',sources.length);
  const rows=[];
  for(const s of sources){
    const t0=Date.now();
    let dur,found='?',ok='?',status;
    try{
      const ctrl=new AbortController(); const to=setTimeout(()=>ctrl.abort(),70000);
      const res=await fetch(BASE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:E,source:s}),signal:ctrl.signal});
      clearTimeout(to); status=res.status; dur=(Date.now()-t0)/1000;
      try{const j=await res.json(); const r=(j.results||[])[0]||{}; found=r.itemsFound??'?'; ok=r.success??'?';}catch{found='NONJSON';}
    }catch(e){dur=(Date.now()-t0)/1000; status='ABORT';}
    rows.push({s,dur,found,ok,status});
    console.log(s.padEnd(20),(status+'').padEnd(5),dur.toFixed(1)+'s','found='+found);
  }
  rows.sort((a,b)=>b.dur-a.dur);
  console.log('\n=== EN YAVAŞ 15 ===');
  rows.slice(0,15).forEach(r=>console.log('  ',r.s.padEnd(20),r.dur.toFixed(1)+'s','found='+r.found,'ok='+r.ok));
  const sum=rows.reduce((a,r)=>a+r.dur,0);
  console.log('\nTOPLAM (sıralı):',sum.toFixed(0)+'s','| >10sn süren:',rows.filter(r=>r.dur>10).length,'| >20sn:',rows.filter(r=>r.dur>20).length);
})().catch(e=>console.error('ERR',e.message));
