/* AirGradient — Personal dashboard */
const { useState: usePD } = React;

function StatTile({ label, icon, value, unit, delta, deltaDir, sub }) {
  return (
    <div className="card stat">
      <div className="lab">{icon && <Icon name={icon} size={14} />}{label}</div>
      <div className="val">{value}{unit && <span className="u"> {unit}</span>}</div>
      {delta != null && <div className={"delta " + (deltaDir || "flat")}>{deltaDir === "up" ? "▲" : deltaDir === "down" ? "▼" : "—"} {delta}<span style={{ color: "var(--text-faint)", fontWeight: 500 }}>{sub}</span></div>}
      {delta == null && sub && <div className="delta flat">{sub}</div>}
    </div>
  );
}

function PersonalView({ store, todayClarity, goJourney, goMedals }) {
  const AG = window.AG, AGS = window.AGS;
  const [range, setRange] = usePD("week");
  const uid = store.currentUser.id;
  const es = store.entries.filter((e) => e.userId === uid && e.feedback !== undefined);
  const own = store.entries.filter((e) => e.userId === uid);

  let curKeys, prevKeys, label;
  if (range === "week") { curKeys = AGS.weekKeys(AG.TODAY_KEY); prevKeys = AGS.weekKeys(AGS.keyMinus(curKeys[0], 1)); label = "this week"; }
  else { const n = range === "4w" ? 28 : 84; curKeys = AGS.lastNKeys(AG.TODAY_KEY, n); prevKeys = AGS.lastNKeys(AGS.keyMinus(curKeys[0], 1), n); label = range === "4w" ? "last 4 weeks" : "last 12 weeks"; }

  const cur = AGS.totals(own, curKeys);
  const prev = AGS.totals(own, prevKeys);
  const curEntries = own.filter((e) => curKeys.includes(e.date));
  const delta = (a, b) => { if (!b) return { t: a ? "new" : "—", d: a ? "up" : "flat" }; const p = Math.round((a - b) / b * 100); return { t: (p >= 0 ? "+" : "") + p + "%", d: p > 1 ? "up" : p < -1 ? "down" : "flat" }; };
  const dH = delta(cur.mins, prev.mins);

  // bars
  let bars;
  if (range === "week") {
    bars = AGS.hoursByDay(own, curKeys).map((d) => ({ label: window.weekdayShort(d.dow)[0], total: d.total, today: d.key === AG.TODAY_KEY, segs: d.segs }));
  } else {
    const wk = range === "4w" ? 4 : 12; bars = [];
    for (let b = wk - 1; b >= 0; b--) {
      const end = AGS.keyMinus(AG.TODAY_KEY, b * 7); const keys = AGS.lastNKeys(end, 7);
      const dd = AGS.hoursByDay(own, keys); const total = dd.reduce((s, x) => s + x.total, 0);
      const byCat = {}; dd.forEach((x) => x.segs.forEach((s) => byCat[s.color] = (byCat[s.color] || 0) + s.mins));
      bars.push({ label: b === 0 ? "now" : AGS.monthLabel(keys[0]), total, today: b === 0, segs: Object.entries(byCat).map(([color, mins]) => ({ color, mins })) });
    }
  }
  const maxBar = Math.max(1, ...bars.map((b) => b.total));
  const cats = AGS.hoursByCategory(curEntries);
  const flow = AGS.dist(curEntries, "flowQuality", AG.FLOW);
  const eff = AGS.dist(curEntries, "efficiencyFeel", AG.EFF);
  const energy = AGS.dist(curEntries, "energy", AG.ENERGY);
  const blockers = AGS.blockerPatterns(curEntries);
  const eva = AGS.estimateVsActual(curEntries);
  const onTarget = AGS.onTargetPct(curEntries);
  const weeks = AGS.weeklyHours(own, AG.TODAY_KEY, 10);
  const trendPts = weeks.map((w, i) => ({ v: w.hours, last: i === weeks.length - 1 }));
  const earnedMedals = AG.medals.filter((m) => m.earned).length;
  const streak = AGS.streak(own, AG.TODAY_KEY);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-l"><div className="eyebrow">Personal · private</div><div className="page-title">Your dashboard</div>
          <div className="page-sub">A detailed picture of your weeks — only you see this.</div></div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn sm" onClick={() => store.exportData("csv")}><Icon name="download" size={15} /> CSV</button>
          <button className="btn sm" onClick={() => store.exportData("json")}>JSON</button>
          <PrivacyPill lens="you" />
        </div>
      </div>

      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="seg">
          <button className={range === "week" ? "on" : ""} onClick={() => setRange("week")}>This week</button>
          <button className={range === "4w" ? "on" : ""} onClick={() => setRange("4w")}>4 weeks</button>
          <button className={range === "12w" ? "on" : ""} onClick={() => setRange("12w")}>12 weeks</button>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>{label} · {cur.active} active days</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <StatTile label="Tracked" icon="clock" value={window.fmtHrs(cur.mins)} unit="h" delta={dH.t} deltaDir={dH.d} sub=" vs prev" />
        <StatTile label="Great-flow" icon="spark" value={cur.great} sub="sessions" />
        <StatTile label="Avg switches" icon="switch" value={cur.ctxAvg} sub="per session" />
        <StatTile label="Streak" icon="journey" value={streak} sub="Breezy days" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", marginBottom: 16 }}>
        <div className="card pad">
          <div className="card-h"><h3>{range === "week" ? "Hours by day" : "Hours by week"}</h3><span className="sub">stacked by category</span></div>
          <StackBars days={bars} maxMins={maxBar} />
        </div>
        <div className="card pad">
          <div className="card-h"><h3>Where it went</h3><span className="sub">{label}</span></div>
          <div className="donut-wrap">
            <Donut size={132} segments={cats.map((c) => ({ value: c.mins, color: c.color }))} centerTop={window.fmtHrs(cur.mins)} centerBot="hours" />
            <div className="legend">{cats.map((c) => (
              <div className="legend-row" key={c.id}><span className="dot" style={{ background: c.color }} /><span className="nm">{c.name}</span><span className="vl">{window.fmtHrs(c.mins)}h</span></div>
            ))}</div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 16 }}>
        <div className="card pad"><div className="card-h"><h3>Flow</h3></div><DistBars rows={flow} colors={["var(--flow-great)", "var(--flow-neutral)", "var(--flow-friction)"]} /></div>
        <div className="card pad"><div className="card-h"><h3>Efficiency</h3></div><DistBars rows={eff} colors={["var(--ag-blue)", "var(--text-faint)", "var(--ag-orange)"]} /></div>
        <div className="card pad"><div className="card-h"><h3>Energy</h3></div><DistBars rows={energy} colors={["var(--green)", "var(--ag-blue-l)", "var(--ag-orange)"]} /></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.3fr", marginBottom: 16 }}>
        <div className="card pad">
          <div className="card-h"><h3>Top blockers</h3><span className="sub">{label}</span></div>
          {blockers.length === 0 ? <div className="muted" style={{ fontSize: 14 }}>Clear skies — no blockers logged this week.</div>
            : blockers.slice(0, 5).map((b, i) => (
              <div className="row between" key={b.id} style={{ padding: "8px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}>
                <span className="row" style={{ gap: 9 }}><span style={{ width: 22, color: "var(--text-faint)", fontWeight: 700, fontSize: 13 }}>{i + 1}.</span><span style={{ fontSize: 13.5, fontWeight: 600 }}>{b.name}</span></span>
                <span className="muted mono" style={{ fontSize: 12.5 }}>{b.count}× · {window.fmtHM(b.mins)}</span>
              </div>
            ))}
        </div>
        <div className="card pad">
          <div className="card-h"><h3>Estimate vs actual</h3><span className="sub mono">{onTarget}% on target</span></div>
          {eva.map((r) => {
            const over = r.variance > 0;
            return (
              <div className="row between" key={r.taskId} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
                <span className="muted mono" style={{ fontSize: 12.5, width: 130, textAlign: "right" }}>{r.actual}m / {r.est}m <b style={{ color: over ? "var(--ag-orange-d)" : "var(--green)" }}>{over ? "+" : ""}{r.variance}m</b></span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
        <div className="card pad">
          <div className="card-h"><h3>Weekly hours trend</h3><span className="sub">last 10 weeks · dashed = 32h target</span></div>
          <TrendLine points={trendPts} target={32} h={150} />
          <div className="month-row" style={{ padding: "10px 6px 0" }}>{["Apr", "May", "Jun"].map((m) => <span key={m} style={{ fontSize: 12, color: "var(--text-faint)" }}>{m}</span>)}</div>
        </div>
        <div className="grid" style={{ gap: 16, gridTemplateColumns: "1fr", alignContent: "start" }}>
          <div className="card pad" style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={goJourney}>
            <Breezy mood={window.moodForClarity(todayClarity || 70)} size={56} />
            <div><div style={{ fontWeight: 800, fontFamily: "var(--ff-head)" }}>Breezy is {todayClarity >= 70 ? "breathing easy" : "a little hazy"}</div>
              <div className="muted" style={{ fontSize: 13 }}>Open your Breezy Journey →</div></div>
          </div>
          <div className="card pad" style={{ cursor: "pointer" }} onClick={goMedals}>
            <div className="card-h"><h3>Medals</h3><span className="sub">{earnedMedals} earned</span></div>
            <div className="row" style={{ gap: 6 }}>
              {AG.medals.filter((m) => m.earned).slice(0, 6).map((m) => <span key={m.code} title={m.name} style={{ fontSize: 22 }}>{m.emoji}</span>)}
              <span className="muted" style={{ fontSize: 13, marginLeft: "auto", alignSelf: "center" }}>View all →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.PersonalView = PersonalView;
window.StatTile = StatTile;
