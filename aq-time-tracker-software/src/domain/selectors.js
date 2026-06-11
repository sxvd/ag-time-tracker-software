/* AirGradient — pure selectors over AG.entries → window.AGS */
(function(){
  "use strict";
  const D=()=>window.AG;
  function keyMinus(key,n){const[y,m,d]=key.split("-").map(Number);return D().dateKey(new Date(y,m-1,d-n));}
  function dowOf(key){const[y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d).getDay();}
  function lastNKeys(end,n){const o=[];for(let i=n-1;i>=0;i--)o.push(keyMinus(end,i));return o;}
  function weekKeys(key){const dow=dowOf(key);const back=(dow+6)%7;const mon=keyMinus(key,back);return lastNKeys(keyMinus(mon,-6),7);}

  function userEntries(uid){return D().entries.filter(e=>e.userId===uid);}
  function teamEntries(team){const us=new Set(D().users.filter(u=>team==="All"||u.team===team).map(u=>u.id));return D().entries.filter(e=>us.has(e.userId));}

  function sumMins(es){return es.reduce((s,e)=>s+e.dur,0);}
  function catOf(id){return D().categories.find(c=>c.id===id);}
  function catIdOfEntry(e){ const t=D().tasks.find(t=>t.id===e.taskId); return (t&&t.categoryId)||e._draftCat||"other"; }
  function catOfEntry(e){ return catOf(catIdOfEntry(e))||catOf("other"); }

  function hoursByDay(es, keys){
    return keys.map(k=>{
      const day=es.filter(e=>e.date===k);
      const byCat={}; day.forEach(e=>{ const cid=catIdOfEntry(e); byCat[cid]=(byCat[cid]||0)+e.dur; });
      return { key:k, dow:dowOf(k), total:sumMins(day),
        segs:Object.entries(byCat).map(([id,m])=>({mins:m,color:(catOf(id)||catOf("other")).color})) };
    });
  }
  function hoursByCategory(es){
    const m={}; es.forEach(e=>{ const cid=catIdOfEntry(e); m[cid]=(m[cid]||0)+e.dur; });
    return D().categories.map(c=>({...c,mins:m[c.id]||0})).filter(c=>c.mins>0).sort((a,b)=>b.mins-a.mins);
  }
  function dist(es, field, opts){
    const m={}; let n=0;
    es.forEach(e=>{ if(e.feedback&&e.feedback[field]){ m[e.feedback[field]]=(m[e.feedback[field]]||0)+1; n++; } });
    return opts.map(o=>({name:o, count:m[o]||0, pct:n?Math.round((m[o]||0)/n*100):0}));
  }
  function blockerPatterns(es){
    const m={};
    es.forEach(e=>e.blockers.filter(b=>b!=="none").forEach(b=>{ if(!m[b])m[b]={count:0,mins:0}; m[b].count++; m[b].mins+=e.dur; }));
    return Object.entries(m).map(([id,v])=>({id,name:(D().blockerDefs.find(x=>x.id===id)||{}).name||id,...v}))
      .sort((a,b)=>b.mins-a.mins);
  }
  function estimateVsActual(es){
    const byTask={};
    es.forEach(e=>{ if(!byTask[e.taskId])byTask[e.taskId]={actual:0,est:e.estimateMinutes||0}; byTask[e.taskId].actual+=e.dur; });
    return Object.entries(byTask).map(([tid,v])=>{
      const t=D().tasks.find(t=>t.id===tid);
      return { taskId:tid, title:t?t.title:"Task", est:v.est, actual:Math.round(v.actual), variance:Math.round(v.actual-v.est) };
    }).filter(r=>r.actual>20).sort((a,b)=>Math.abs(b.variance)-Math.abs(a.variance)).slice(0,6);
  }
  function onTargetPct(es){
    const rows=estimateVsActual(es); if(!rows.length)return 0;
    const ok=rows.filter(r=>r.est>0&&Math.abs(r.variance)<=r.est*0.2).length;
    return Math.round(ok/rows.length*100);
  }
  function weeklyHours(es,end,weeks){
    const out=[];
    for(let w=weeks-1;w>=0;w--){
      const wkEnd=keyMinus(end,w*7); const wk=new Set(lastNKeys(wkEnd,7));
      let mins=0,cs=0,cnt=0;
      es.forEach(e=>{ if(wk.has(e.date)){ mins+=e.dur; cs+=e.contextSwitches; cnt++; } });
      const monthKey=keyMinus(wkEnd,6);
      out.push({ mins, hours:+(mins/60).toFixed(1), ctxAvg: cnt?+(cs/cnt).toFixed(1):0, monthName: monthLabel(monthKey), weekStart:monthKey });
    }
    return out;
  }
  function monthLabel(key){const[y,m]=key.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString("en-US",{month:"short"});}

  function streak(es,end){
    let s=0;
    for(let i=0;i<400;i++){const k=keyMinus(end,i);const has=es.some(e=>e.date===k);if(has)s++;else if(i===0)continue;else break;}
    return s;
  }
  function totals(es,keys){
    const set=new Set(keys); const f=es.filter(e=>set.has(e.date));
    return { mins:sumMins(f), active:new Set(f.map(e=>e.date)).size, entries:f.length,
      ctxAvg: f.length? +(f.reduce((s,e)=>s+e.contextSwitches,0)/f.length).toFixed(1):0,
      idleMins: Math.round(f.reduce((s,e)=>s+e.idleSeconds,0)/60),
      great: f.filter(e=>e.feedback&&e.feedback.flowQuality==="Great flow").length };
  }

  window.AGS={ keyMinus,dowOf,lastNKeys,weekKeys,monthLabel,userEntries,teamEntries,sumMins,catOf,catIdOfEntry,catOfEntry,
    hoursByDay,hoursByCategory,dist,blockerPatterns,estimateVsActual,onTargetPct,weeklyHours,streak,totals };
})();
