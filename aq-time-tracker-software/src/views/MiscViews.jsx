/* AirGradient — Medals, History, Settings, Profile */
const { useState: useMisc } = React;

function MedalsView() {
  const AG = window.AG;
  const earned = AG.medals.filter((m) => m.earned).length;
  const groups = {};
  AG.medals.forEach((m) => { (groups[m.group] = groups[m.group] || []).push(m); });
  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-l"><div className="eyebrow">Personal · private</div><div className="page-title">Your medals</div>
          <div className="page-sub">{earned} of {AG.medals.length} earned. Calm, earned rewards — never a leaderboard.</div></div>
        <PrivacyPill lens="you" />
      </div>
      {earned === 0 ? (
        <div className="empty-state card pad"><Breezy mood="waving" size={86} /><div className="et">Your first medal is on its way.</div></div>
      ) : (
        <div className="medal-grid">
          {AG.medals.slice().sort((a, b) => (b.earned ? 1 : 0) - (a.earned ? 1 : 0)).map((m) => (
            <div className={"medal " + (m.earned ? "earned" : "locked")} key={m.code}>
              <div className="medal-badge">{m.earned ? m.emoji : <Icon name="lock" size={22} />}</div>
              <div className="mn">{m.name}</div>
              <div className="md">{m.desc}</div>
              {m.earned && <div className="earned-tag">Earned</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryView({ store }) {
  const AG = window.AG, AGS = window.AGS;
  const src = store.entries.filter((e) => e.userId === store.currentUser.id);
  const sorted = src.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.start - a.start));
  // group by date
  const groups = {};
  sorted.forEach((e) => { (groups[e.date] = groups[e.date] || []).push(e); });
  const dateLabel = (k) => k === AG.TODAY_KEY ? "Today" : k === AGS.keyMinus(AG.TODAY_KEY, 1) ? "Yesterday" : window.prettyDate(k);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-l"><div className="eyebrow">Personal - private</div><div className="page-title">History</div>
          <div className="page-sub">Only this account's tracked sessions are shown here.</div></div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn sm" onClick={() => store.exportData("csv")}><Icon name="download" size={15} /> CSV</button>
          <button className="btn sm" onClick={() => store.exportData("json")}>JSON</button>
        </div>
      </div>
      {Object.keys(groups).slice(0, 14).map((k) => (
        <div className="card pad" key={k} style={{ marginBottom: 14 }}>
          <div className="card-h"><h3>{dateLabel(k)}</h3><span className="sub mono">{window.fmtHM(groups[k].reduce((s, e) => s + e.dur, 0))}</span></div>
          {groups[k].map((e) => {
            const t = window.taskOf(e.taskId) || { title: e._draftTitle || "Task", categoryId: e._draftCat || "other" };
            const c = window.catOf(t.categoryId) || window.catOf("other");
            return (
              <div className="entry" key={e.id}>
                <span className="cat-dot" style={{ background: c.color + "1f", color: c.color }}><CatIcon id={c.icon} size={17} /></span>
                <div className="e-main">
                  <div className="e-title">{t.title}
                    {e.isManual && <span className="tag-mini tag-manual"><Icon name="rewind" size={10} /> Manual</span>}
                  </div>
                  <div className="e-meta"><span className="mono">{window.startToClock(e.start)}–{window.startToClock(e.start + e.dur)}</span>
                    {e.feedback && <><span>·</span><span>{e.feedback.flowQuality}</span></>}
                    {e.blockers.filter((b) => b !== "none").length > 0 && <span className="tag-mini tag-block"><Icon name="flag" size={10} /> {e.blockers.filter((b) => b !== "none").map((b) => (AG.blockerDefs.find((x) => x.id === b) || {}).name).join(", ")}</span>}
                  </div>
                </div>
                <span className="e-dur">{window.fmtHM(e.dur)}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SettingsView({ store }) {
  const { settings, setSettings, profile, setProfile } = store;
  const set = (p) => setSettings((s) => ({ ...s, ...p }));
  const Toggle = ({ on, onChange, label }) => (
    <button className={"toggle" + (on ? " on" : "")} onClick={() => onChange(!on)}><span className="track"><span className="knob" /></span>{label}</button>
  );
  return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-l"><div className="eyebrow">You</div><div className="page-title">Settings & profile</div>
        <div className="page-sub">Tune Breezy and how tracking behaves.</div></div></div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card pad">
          <div className="card-h"><h3>Profile</h3></div>
          <div className="grid" style={{ gap: 14 }}>
            <div className="field"><label>Display name</label><input className="input" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="field"><label>Team <span className="muted" style={{ fontWeight: 500 }}>· used for company rollups</span></label>
              <select className="input" value={profile.team} onChange={(e) => setProfile((p) => ({ ...p, team: e.target.value }))}>
                {window.AG.teams.map((t) => <option key={t}>{t}</option>)}
              </select></div>
            <div className="field"><label>Email</label><input className="input" value={store.currentUser.email} disabled style={{ opacity: .6 }} /></div>
          </div>
        </div>

        <div className="card pad">
          <div className="card-h"><h3>Breezy</h3></div>
          <div className="grid" style={{ gap: 16 }}>
            <div className="field"><label>Breezy voice</label>
              <div className="seg" style={{ alignSelf: "flex-start" }}>
                {["quiet", "gentle", "chatty"].map((v) => <button key={v} className={settings.verbosity === v ? "on" : ""} onClick={() => set({ verbosity: v })}>{v}</button>)}
              </div>
            </div>
            <Toggle on={settings.muted} onChange={(v) => set({ muted: v })} label="Mute all Breezy nudges" />
            <Toggle on={settings.theme === "dark"} onChange={(v) => set({ theme: v ? "dark" : "light" })} label="Dark mode" />
          </div>
        </div>

        <div className="card pad">
          <div className="card-h"><h3>Automatic tracking</h3></div>
          <div className="grid" style={{ gap: 16 }}>
            <div className="field"><label>Idle threshold: {settings.idleThreshold} min</label>
              <input type="range" min="1" max="20" value={settings.idleThreshold} onChange={(e) => set({ idleThreshold: +e.target.value })} /></div>
            <div className="field"><label>Ventilation nudge every: {settings.nudgeCadence} min</label>
              <input type="range" min="30" max="180" step="15" value={settings.nudgeCadence} onChange={(e) => set({ nudgeCadence: +e.target.value })} /></div>
            <Toggle on={settings.locationEnabled} onChange={(v) => set({ locationEnabled: v })} label="Attach a location label (opt-in)" />
            <div className="muted" style={{ fontSize: 12.5 }}>Context switches are counted only — Breezy never logs which sites or apps you visit.</div>
          </div>
        </div>

        <div className="card pad">
          <div className="card-h"><h3>Your data</h3></div>
          <div className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>Your raw sessions are yours. Export everything — tags, feedback, blockers, idle, switches — any time.</div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn primary" onClick={() => store.exportData("csv")}><Icon name="download" size={15} /> Export CSV</button>
            <button className="btn" onClick={() => store.exportData("json")}><Icon name="download" size={15} /> Export JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.MedalsView = MedalsView;
window.HistoryView = HistoryView;
window.SettingsView = SettingsView;
