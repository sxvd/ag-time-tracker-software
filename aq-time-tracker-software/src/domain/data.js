/* AirGradient Time Tracker — mock data. Plain JS → window.AG. */
(function () {
  "use strict";
  function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
  const rand = mulberry32(20260610);
  const pick = (a)=>a[Math.floor(rand()*a.length)];
  const between=(lo,hi)=>lo+rand()*(hi-lo);

  // ---- categories (editable; icon + color) ----
  const categories = [
    { id:"deep",   name:"Deep work", icon:"deep",   color:"#1C75BC" },
    { id:"meeting",name:"Meeting",   icon:"meeting", color:"#FC7E10" },
    { id:"admin",  name:"Admin",     icon:"admin",  color:"#7a59c6" },
    { id:"comms",  name:"Comms",     icon:"comms",  color:"#2aa6a0" },
    { id:"research",name:"Research", icon:"research",color:"#c2418f" },
    { id:"other",  name:"Other",     icon:"other",  color:"#6c7d8d" },
  ];

  const teams = ["COMMS","Hardware","Software","Design"];

  const users = [
    { id:"u1", email:"maya@airgradient.com",  name:"Maya Okafor",   team:"Hardware", you:true },
    { id:"u2", email:"theo@airgradient.com",  name:"Theo Lindqvist",team:"Software" },
    { id:"u3", email:"ivy@airgradient.com",   name:"Ivy Chen",      team:"COMMS" },
    { id:"u4", email:"sam@airgradient.com",   name:"Sam Reyes",     team:"Software" },
    { id:"u5", email:"nadia@airgradient.com", name:"Nadia Haddad",  team:"Design" },
    { id:"u6", email:"ken@airgradient.com",   name:"Ken Watabe",    team:"Hardware" },
  ];

  const clients = [
    { id:"cl1", name:"AirGradient" },
    { id:"cl2", name:"Open Monitor" },
    { id:"cl3", name:"Internal" },
  ];
  const projects = [
    { id:"p1", clientId:"cl1", name:"AG One sensor" },
    { id:"p2", clientId:"cl1", name:"Dashboard v3" },
    { id:"p3", clientId:"cl2", name:"Map ingest" },
    { id:"p4", clientId:"cl3", name:"Ops" },
  ];

  const taskTitles = {
    deep:["PCB layout review","Firmware bring-up","Calibration routine","Sensor driver refactor","Map ingest pipeline"],
    meeting:["Standup","Design sync","Sprint planning","Hardware review"],
    admin:["Expense filing","Backlog grooming","Inbox triage","Release notes"],
    comms:["Slack + email","Community reply","Newsletter draft","Forum support"],
    research:["Spec review","PM2.5 paper read","Competitor teardown","Datasheet study"],
    other:["Office setup","Workshop tidy","Misc"],
  };

  const blockerDefs = [
    { id:"wait",   name:"Waiting on someone" },
    { id:"tool",   name:"Tool was slow or broke" },
    { id:"unclear",name:"Unclear requirements" },
    { id:"interrupt",name:"Interruptions" },
    { id:"ctxsw",  name:"Context switching" },
    { id:"meeting",name:"Meetings overran" },
    { id:"none",   name:"None" },
  ];

  const FLOW=["Great flow","Neutral","Friction"];
  const EFF=["Felt efficient","Felt manual","Felt wasteful"];
  const ENERGY=["High","OK","Drained"];
  const notes=["Good momentum, stayed in the zone.","Kept getting pinged on Slack.","Paired with Theo, untangled the bug.","Lots of dead ends early then clicked.","Calm session, cleared the backlog.","Meeting ran long, lost the thread.","Felt sharp this morning.","Bit scattered, too many tabs."];

  // ---- tasks ----
  const tasks = [];
  let tid=1;
  categories.forEach((c)=>{ taskTitles[c.id].forEach((t)=>{
    tasks.push({ id:"t"+(tid++), title:t, categoryId:c.id, clientId:pick(clients).id, projectId:pick(projects).id,
      estimateMinutes: Math.round(between(30,150)/15)*15, ownerId: pick(users).id, isShared:false, members:[] });
  });});
  // one shared task
  const shared = tasks.find((t)=>t.title==="Map ingest pipeline");
  shared.isShared=true; shared.ownerId="u1"; shared.members=["u1","u2","u4"];

  // ---- entries ----
  const DAY=86400000;
  const TODAY=new Date(2026,5,10); TODAY.setHours(0,0,0,0); // Jun 10 2026 (Wed)
  const dateKey=(d)=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");

  const entries=[]; let eid=1;
  const DAYS_BACK=70;
  users.forEach((u)=>{
    const dense = u.you ? 1 : between(0.55,0.95); // others vary
    for(let i=DAYS_BACK;i>=0;i--){
      const d=new Date(TODAY.getTime()-i*DAY); const dow=d.getDay();
      const weekend=dow===0||dow===6;
      let skip = weekend ? rand()<0.8 : rand()<(u.you?0.08:0.2);
      if(u.you && i<=33 && i>=29) skip=true; // vacation gap
      if(rand()>dense) skip=true;
      if(skip) continue;
      const isToday=i===0;
      const blocks = isToday&&u.you ? 2 : (weekend?1:2+Math.floor(rand()*3));
      let cursor=9*60+Math.floor(between(-30,40));
      for(let b=0;b<blocks;b++){
        const utasks = tasks.filter((t)=>t.ownerId===u.id || (t.members||[]).includes(u.id));
        const task = utasks.length? pick(utasks): pick(tasks);
        const cat=task.categoryId;
        const dur=Math.round(between(30,135)/5)*5;
        const flow = cat==="meeting"? pick(["Friction","Neutral","Neutral"]) : (rand()<0.5?"Great flow":pick(FLOW));
        const eff = flow==="Great flow"? "Felt efficient" : pick(EFF);
        const energy = b>2? pick(["OK","Drained"]) : pick(ENERGY);
        const hasFb = isToday? false : rand()<0.82;
        const blks=[];
        if(rand()<0.28){ const cand=blockerDefs.filter(x=>x.id!=="none"); blks.push(pick(cand).id); if(rand()<0.3) blks.push(pick(cand).id);} 
        entries.push({
          id:"e"+(eid++), taskId:task.id, userId:u.id, date:dateKey(d), dow,
          start:cursor, dur, durationSeconds:dur*60,
          isManual: rand()<0.08,
          idleSeconds: rand()<0.3? Math.round(between(60,600)):0,
          contextSwitches: Math.round(between(0, cat==="deep"?6:18)),
          locationLabel: pick(["Office","Home","Cafe",""]),
          estimateMinutes: task.estimateMinutes,
          feedback: hasFb? { flowQuality:flow, efficiencyFeel:eff, energy, note: rand()<0.45?pick(notes):"" } : null,
          blockers: [...new Set(blks)],
        });
        cursor += dur + Math.round(between(10,55));
        if(cursor>19*60) break;
      }
    }
  });

  // ---- breezy days (own user) : derive mood + air clarity from hours/habits/flow ----
  function moodForClarity(c){ if(c>=85)return"happy"; if(c>=70)return"engineer"; if(c>=55)return"focused"; if(c>=40)return"thinking"; if(c>=25)return"haze-low"; return"haze-high"; }
  const breezyDays={};
  const ownEntries=entries.filter(e=>e.userId==="u1");
  const byDate={};
  ownEntries.forEach(e=>{ (byDate[e.date]=byDate[e.date]||[]).push(e); });
  Object.keys(byDate).forEach((dk)=>{
    const es=byDate[dk]; const mins=es.reduce((s,e)=>s+e.dur,0);
    const great=es.filter(e=>e.feedback&&e.feedback.flowQuality==="Great flow").length;
    const blocked=es.filter(e=>e.blockers.length).length;
    const hrs=mins/60;
    let clarity = Math.min(100, Math.round(hrs/7*55 + great*14 - blocked*8 + 30));
    clarity=Math.max(12,clarity);
    breezyDays[dk]={ date:dk, hours:+hrs.toFixed(1), airClarity:clarity, mood:moodForClarity(clarity), great, blocked };
  });

  // ---- medals (config-driven; extendable) ----
  const medals=[
    { code:"in_the_zone", name:"In the Zone", emoji:"🎯", group:"focus", desc:"5 Great-flow sessions", earned:true },
    { code:"fresh_air", name:"Fresh Air", emoji:"🌿", group:"air-and-clarity", desc:"Took a ventilation break", earned:true },
    { code:"honest_reviewer", name:"Honest Reviewer", emoji:"📝", group:"honesty", desc:"Left feedback on 20 sessions", earned:true },
    { code:"steady_breeze", name:"Steady Breeze", emoji:"🍃", group:"consistency", desc:"Tracked 5 days in a row", earned:true },
    { code:"hydrated", name:"Hydrated", emoji:"💧", group:"rhythm-and-rest", desc:"Took 10 water breaks", earned:true },
    { code:"clear_skies", name:"Clear Skies", emoji:"☀️", group:"air-and-clarity", desc:"A full clear-air week", earned:true },
    { code:"single_tasker", name:"Single-Tasker", emoji:"🎯", group:"focus", desc:"A session with 0 context switches", earned:true },
    { code:"deep_breath", name:"Deep Breath", emoji:"🫁", group:"rhythm-and-rest", desc:"Took a break after 90 min", earned:false },
    { code:"blue_sky", name:"Blue Sky Day", emoji:"🌤️", group:"air-and-clarity", desc:"Air clarity 90+ for a day", earned:false },
    { code:"flow_state", name:"Flow State", emoji:"🌊", group:"focus", desc:"3-hour focused stretch", earned:false },
    { code:"pattern_spotter", name:"Pattern Spotter", emoji:"🔍", group:"self-knowledge", desc:"Reviewed your weekly trends", earned:false },
    { code:"sustainable", name:"Sustainable Pace", emoji:"⚖️", group:"rhythm-and-rest", desc:"No day over 9h this week", earned:false },
    { code:"cleared_haze", name:"Cleared the Haze", emoji:"🌬️", group:"air-and-clarity", desc:"Recovered from a hazy week", earned:false },
    { code:"breezy_best", name:"Breezy's Best Day", emoji:"⭐", group:"breezy-milestones", desc:"Your highest-clarity day yet", earned:false },
  ];

  window.AG = {
    TODAY, TODAY_KEY:dateKey(TODAY), dateKey, DAY,
    categories, teams, users, clients, projects, tasks, entries, blockerDefs, medals, breezyDays,
    FLOW, EFF, ENERGY,
    me: users[0],
    company:{ name:"AirGradient", size: users.length },
    settings:{ idleThreshold:5, nudgeCadence:90, verbosity:"gentle", muted:false, theme:"light", locationEnabled:false },
  };
})();
