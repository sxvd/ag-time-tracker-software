/* AirGradient — Company dashboard (aggregated, process-focused) */
const { useState: useCo } = React;

function CompanyView({ store }) {
  const AG = window.AG, AGS = window.AGS;
  const [team, setTeam] = useCo("All");
  const es = AGS.teamEntries(team).filter((e) => e.feedback !== undefined);
  const keys = AGS.lastNKeys(AG.TODAY_KEY, 28);
  const cur = es.filter((e) => keys.includes(e.date));

  const cats = AGS.hoursByCategory(cur);
  const totalMins = cats.reduce((s, c) => s + c.mins, 0);
  const blockers = AGS.blockerPatterns(cur);
  const maxBlk = Math.max(1, ...blockers.map((b) => b.mins));
  const flow = AGS.dist(cur, "flowQuality", AG.FLOW);
  const teamWeeks = AGS.weeklyHours(es, AG.TODAY_KEY, 8);
  const ctxPts = teamWeeks.map((w, i) => ({ v: w.ctxAvg, last: i === teamWeeks.length - 1 }));
  const headcount = AG.users.filter((u) => team === "All" || u.team === team).length;
  const greatPct = flow.find((f) => f.name === "Great flow")?.pct || 0;
  const avgSwitch = ctxPts.length ? ctxPts[ctxPts.length - 1].v : 0;

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-l"><div className="eyebrow">Aggregated · process</div><div className="page-title">Studio overview</div>
          <div className="page-sub">{AG.company.name} · {headcount} {headcount === 1 ? "person" : "people"} · last 4 weeks</div></div>
        <PrivacyPill lens="company" />
      </div>

      <div className="card pad" style={{ marginBottom: 16, display: "flex", gap: 14, alignItems: "center", background: "var(--orange-soft)", borderColor: "#f6d3b0" }}>
        <Breezy mood="engineer" size={48} />
        <div style={{ fontSize: 13.5, color: "var(--text-mid)" }}>
          <strong style={{ color: "var(--text)" }}>Breezy keeps this view anonymous.</strong> No names, no league tables, no hours-per-person — only categories, blockers and trends, so we fix <em>processes</em>, never rank people.
        </div>
      </div>

      <div className="row between wrap" style={{ marginBottom: 16, gap: 12 }}>
        <div className="seg">
          {["All", ...AG.teams].map((t) => <button key={t} className={team === t ? "on" : ""} onClick={() => setTeam(t)}>{t}</button>)}
        </div>
        <span className="muted" style={{ fontSize: 13 }}>filter blockers & time by team</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <StatTile label="Tracked" icon="clock" value={Math.round(totalMins / 60)} unit="h" sub="last 4 weeks" />
        <StatTile label="Great-flow" icon="spark" value={greatPct} unit="%" sub="of sessions" />
        <StatTile label="Blocker time" icon="flag" value={Math.round(blockers.reduce((s, b) => s + b.mins, 0) / 60)} unit="h" delta="+8%" deltaDir="down" sub=" worth a look" />
        <StatTile label="Avg switches" icon="switch" value={avgSwitch} sub="per session" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
        <div className="card pad">
          <div className="card-h"><h3>Where the team's time goes</h3><span className="sub">{team}</span></div>
          <div className="donut-wrap">
            <Donut size={132} segments={cats.map((c) => ({ value: c.mins, color: c.color }))} centerTop={Math.round(totalMins / 60)} centerBot="hours" />
            <div className="legend">{cats.map((c) => (
              <div className="legend-row" key={c.id}><span className="dot" style={{ background: c.color }} /><span className="nm">{c.name}</span><span className="vl">{Math.round(c.mins / totalMins * 100)}%</span></div>
            ))}</div>
          </div>
        </div>
        <div className="card pad">
          <div className="card-h"><h3>Flow distribution</h3><span className="sub">team · {team}</span></div>
          <DistBars rows={flow} colors={["var(--flow-great)", "var(--flow-neutral)", "var(--flow-friction)"]} />
          <div className="card-h" style={{ margin: "20px 0 12px" }}><h3>Context-switch trend</h3><span className="sub">8 weeks · lower is better</span></div>
          <TrendLine points={ctxPts} h={110} color="var(--ag-orange)" />
        </div>
      </div>

      <div className="card pad">
        <div className="card-h"><h3>Top blockers across the team</h3><span className="sub">ranked by time · {team}</span></div>
        {blockers.length === 0 ? <div className="muted">Clear skies — no blockers logged.</div> : (
          <div className="grid" style={{ gap: 13 }}>
            {blockers.map((b, i) => (
              <div className="row" key={b.id} style={{ gap: 14 }}>
                <span style={{ width: 18, color: "var(--text-faint)", fontWeight: 700, fontSize: 13, flex: "none" }}>{i + 1}</span>
                <span style={{ width: 168, fontSize: 13.5, fontWeight: 700, flex: "none" }}>{b.name}</span>
                <span style={{ flex: 1, height: 22, background: "var(--surface-3)", borderRadius: 7, overflow: "hidden" }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, width: (b.mins / maxBlk * 100) + "%", height: "100%", background: "var(--ag-orange)", borderRadius: 7 }}>
                    <b className="mono" style={{ fontSize: 11.5, color: "#fff" }}>{Math.round(b.mins / 60)}h</b>
                  </span>
                </span>
                <span className="muted mono" style={{ fontSize: 12, width: 70, textAlign: "right", flex: "none" }}>{b.count} sess.</span>
              </div>
            ))}
          </div>
        )}
        <div className="row" style={{ gap: 10, marginTop: 18, padding: "13px 15px", background: "var(--blue-soft)", borderRadius: "var(--radius-sm)" }}>
          <Breezy mood="notification" size={40} />
          <div style={{ fontSize: 13.5, color: "var(--ag-blue)" }}>
            <strong>Context switching is the fastest-rising blocker.</strong> Several teams flagged fragmented mornings — protecting focus blocks before standup could help.
          </div>
        </div>
      </div>
    </div>
  );
}
window.CompanyView = CompanyView;
