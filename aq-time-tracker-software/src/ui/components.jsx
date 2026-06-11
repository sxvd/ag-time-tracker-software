/* AirGradient — icons, formatters, charts → window */

function fmtHM(mins){mins=Math.max(0,Math.round(mins));const h=Math.floor(mins/60),m=mins%60;if(h===0)return m+"m";return h+"h "+(m?m+"m":"").trim();}
function fmtHrs(mins){return (mins/60).toFixed(1);}
function fmtClock(sec){const p=(n)=>String(n).padStart(2,"0");return{h:p(Math.floor(sec/3600)),m:p(Math.floor(sec%3600/60)),s:p(Math.floor(sec%60))};}
function startToClock(min){let h=Math.floor(min/60),m=min%60;const ap=h>=12?"pm":"am";h=h%12;if(h===0)h=12;return h+":"+String(m).padStart(2,"0")+ap;}
function catOf(id){return window.AG.categories.find(c=>c.id===id);}
function taskOf(id){return window.AG.tasks.find(t=>t.id===id);}
function userOf(id){return window.AG.users.find(u=>u.id===id);}
function initials(n){return n.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase();}
function prettyDate(key){const[y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});}
function weekdayShort(dow){return["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow];}

// ---- generic UI icons ----
const UI={
  play:<path d="M6 4.5v15l13-7.5z"/>,
  pause:<g><rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/></g>,
  stop:<rect x="6" y="6" width="12" height="12" rx="2.5"/>,
  coffee:<g><path d="M4 8h13v5a5 5 0 01-5 5H9a5 5 0 01-5-5z"/><path d="M17 9h2.5a2 2 0 010 4H17"/><path d="M7 3v2M11 3v2"/></g>,
  plus:<path d="M12 5v14M5 12h14"/>,
  clock:<g><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></g>,
  today:<g><rect x="4" y="5" width="16" height="16" rx="2.5"/><path d="M4 9h16M8 3v4M16 3v4"/></g>,
  chart:<g><path d="M4 20V10M10 20V5M16 20v-8M22 20H2"/></g>,
  journey:<g><path d="M5 19c3-1 4-4 7-4s4 3 7 2"/><circle cx="6" cy="9" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 11v4M18 9v6"/></g>,
  medal:<g><circle cx="12" cy="9" r="5.5"/><path d="M9 13.5L7 21l5-2.5L17 21l-2-7.5"/></g>,
  history:<g><path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.4M3 4v4h4"/><path d="M12 8v4l3 2"/></g>,
  settings:<g><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.8 7.8 0 000-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 00-1.7-1l-.3-2.5h-4l-.3 2.5a7.6 7.6 0 00-1.7 1l-2.3-1-2 3.4L4.6 11a7.8 7.8 0 000 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 001.7 1l.3 2.5h4l.3-2.5a7.6 7.6 0 001.7-1l2.3 1 2-3.4z"/></g>,
  user:<g><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></g>,
  sun:<g><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></g>,
  moon:<path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 1010.5 10.5z"/>,
  bell:<g><path d="M18 9a6 6 0 00-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 01-3.4 0"/></g>,
  belloff:<g><path d="M18 9a6 6 0 00-9.3-5M5.4 5.4A6 6 0 006 9c0 7-3 8-3 8h13"/><path d="M13.7 21a2 2 0 01-3.4 0"/><path d="M3 3l18 18"/></g>,
  download:<g><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></g>,
  edit:<g><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/></g>,
  trash:<g><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></g>,
  x:<path d="M6 6l12 12M18 6L6 18"/>,
  check:<path d="M5 12.5l4.5 4.5L19 7"/>,
  rewind:<g><path d="M11 7l-6 5 6 5V7zM19 7l-6 5 6 5V7z"/></g>,
  lock:<g><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></g>,
  building:<g><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/></g>,
  flag:<g><path d="M6 21V4M6 4h11l-2 4 2 4H6"/></g>,
  menu:<path d="M4 6h16M4 12h16M4 18h16"/>,
  spark:<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>,
  switch:<g><path d="M7 4L3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8"/></g>,
  idle:<g><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></g>,
};
// category icons
const CAT={
  deep:<g><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8.5"/></g>,
  meeting:<g><circle cx="9" cy="10" r="3"/><circle cx="16" cy="11" r="2.3"/><path d="M3 19c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5M15.5 14.7c2.6.2 4.5 1.6 4.5 4.3"/></g>,
  admin:<g><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></g>,
  comms:<g><path d="M4 5h16v11H9l-4 4z"/></g>,
  research:<g><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/></g>,
  other:<g><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></g>,
};
function Icon({name,size=18,stroke=1.9,style}){
  const filled=name==="play"||name==="stop"||name==="moon";
  return <svg viewBox="0 0 24 24" width={size} height={size} style={style}
    fill={filled?"currentColor":"none"} stroke={filled?"none":"currentColor"}
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{UI[name]}</svg>;
}
function CatIcon({id,size=18,stroke=1.9}){
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{CAT[id]||CAT.other}</svg>;
}
function CatBadge({id,size=32}){
  const c=catOf(id);
  return <span className="cat-dot" style={{width:size,height:size,background:c.color+"1f",color:c.color}}><CatIcon id={c.icon} size={size*0.53}/></span>;
}

// ---- charts ----
function Donut({segments,size=132,centerTop,centerBot}){
  const total=segments.reduce((s,x)=>s+x.value,0)||1; let acc=0;
  const stops=segments.map(s=>{const f=acc/total*360;acc+=s.value;return `${s.color} ${f}deg ${acc/total*360}deg`;}).join(", ");
  return <div className="donut" style={{width:size,height:size,background:`conic-gradient(${stops})`}}>
    <div className="donut-center"><div>
      <div style={{fontSize:22,fontWeight:800,fontFamily:"var(--ff-head)"}}>{centerTop}</div>
      <div style={{fontSize:11,color:"var(--text-mut)",fontWeight:700}}>{centerBot}</div>
    </div></div>
  </div>;
}
function StackBars({days,maxMins}){
  return <div className="bars">{days.map((d,i)=>{
    const h=maxMins?d.total/maxMins*100:0;
    return <div className="bar-col" key={i}>
      <div className="bar-stack" style={{height:h+"%",minHeight:d.total?6:0}} title={fmtHM(d.total)}>
        {d.segs.map((s,j)=><div className="bar-seg" key={j} style={{height:(s.mins/d.total*100)+"%",background:s.color}}/>)}
      </div>
      <div className={"bar-lab"+(d.today?" today":"")}>{d.label}</div>
    </div>;
  })}</div>;
}
function DistBars({rows,colors}){
  return <div className="dist">{rows.map((r,i)=>(
    <div className="dist-row" key={r.name}>
      <div className="dist-top"><span>{r.name}</span><b>{r.pct}%<span className="muted" style={{fontWeight:500}}> · {r.count}</span></b></div>
      <div className="track-bar"><div className="track-fill" style={{width:r.pct+"%",background:colors[i]||"var(--ag-blue)"}}/></div>
    </div>
  ))}</div>;
}
function TrendLine({points,w=560,h=150,target,color="var(--ag-blue)",lower}){
  const vals=points.map(p=>p.v); const max=Math.max(...vals,target||0)*1.12||1; const pad=12;
  const X=(i)=>pad+i/(points.length-1)*(w-pad*2);
  const Y=(v)=>h-pad-v/max*(h-pad*2);
  const line=points.map((p,i)=>`${i?"L":"M"}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  const area=`${line} L${X(points.length-1)} ${h-pad} L${X(0)} ${h-pad} Z`;
  return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
    {target!=null&&<line x1={pad} x2={w-pad} y1={Y(target)} y2={Y(target)} stroke="var(--green)" strokeWidth="1.5" strokeDasharray="4 5" opacity=".7"/>}
    <path className="trend-area" d={area} style={{fill:color,opacity:.13}}/>
    <path className="trend-line" d={line} style={{stroke:color}}/>
    {points.map((p,i)=><circle key={i} className="trend-dot" cx={X(i)} cy={Y(p.v)} r={p.last?4.5:3} style={{stroke:color}}/>)}
  </svg>;
}

function PrivacyPill({lens}){
  return lens==="company"
    ? <span className="priv co"><Icon name="building" size={12}/> Aggregated · no individuals</span>
    : <span className="priv you"><Icon name="lock" size={12}/> Private to you · exportable</span>;
}

Object.assign(window,{fmtHM,fmtHrs,fmtClock,startToClock,catOf,taskOf,userOf,initials,prettyDate,weekdayShort,
  Icon,CatIcon,CatBadge,Donut,StackBars,DistBars,TrendLine,PrivacyPill});
