/* AirGradient Time Tracker - shell */
const { useState: useApp } = React;

function AuthView({ store }) {
  const [mode, setMode] = useApp("signin");
  const [form, setForm] = useApp({ email: "maya@airgradient.com", password: "breezy123", name: "Maya Okafor", team: "Hardware" });
  const set = (p) => setForm((s) => ({ ...s, ...p }));
  const submit = async (e) => {
    e.preventDefault();
    if (mode === "signin") await store.signIn(form.email, form.password);
    else await store.signUp(form);
  };

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <Breezy mood="waving" size={72} />
        <div>
          <div className="eyebrow">AirGradient Time Tracker</div>
          <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="muted">Database-backed sessions for real multi-user task sharing.</p>
        </div>
        <div className="seg auth-seg">
          <button type="button" className={mode === "signin" ? "on" : ""} onClick={() => setMode("signin")}>Sign in</button>
          <button type="button" className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>Create account</button>
        </div>
        <div className="field"><label>Work email</label><input className="input" value={form.email} onChange={(e) => set({ email: e.target.value })} /></div>
        <div className="field"><label>Password</label><input className="input" type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} /></div>
        {mode === "signup" && <>
          <div className="field"><label>Display name</label><input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="field"><label>Team</label><select className="input" value={form.team} onChange={(e) => set({ team: e.target.value })}>{window.AG.teams.map((t) => <option key={t}>{t}</option>)}</select></div>
        </>}
        {store.authError && <div className="auth-error">{store.authError}</div>}
        <button className="btn primary" type="submit"><Icon name="check" size={15} /> {mode === "signin" ? "Sign in" : "Create account"}</button>
        <div className="muted" style={{ fontSize: 12 }}>Demo password for seeded users: <span className="mono">breezy123</span></div>
      </form>
    </div>
  );
}

function App() {
  const store = window.useAGStore();
  const { settings, setSettings, toasts, dismissToast, pendingFeedback, saveFeedback, entries } = store;
  const [lens, setLens] = useApp("you");
  const [view, setView] = useApp("today");
  const [menuOpen, setMenuOpen] = useApp(false);
  const AG = window.AG;

  if (store.loading) {
    return <div className="auth-shell"><div className="auth-card"><Breezy mood="thinking" size={72} /><h1>Loading sessions...</h1></div></div>;
  }
  if (!store.currentUser) return <AuthView store={store} />;

  const bd = AG.breezyDays[AG.TODAY_KEY];
  const todayClarity = bd ? bd.airClarity : 65;

  const go = (v) => { setView(v); setMenuOpen(false); };
  const switchLens = (l) => { setLens(l); setView(l === "you" ? "today" : "company"); };

  const navYou = [
    { id: "today", label: "Track", icon: "today" },
    { id: "dashboard", label: "Dashboard", icon: "chart" },
    { id: "journey", label: "Breezy Journey", icon: "journey" },
    { id: "medals", label: "Medals", icon: "medal" },
    { id: "history", label: "History", icon: "history" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  const pendingEntry = pendingFeedback ? entries.find((e) => e.id === pendingFeedback) : null;

  return (
    <div className="app">
      {menuOpen && <div className="scrim-m" onClick={() => setMenuOpen(false)} />}
      <aside className={"sidebar" + (menuOpen ? " open" : "")}>
        <div className="brand">
          <Breezy mood="waving" size={40} />
          <div className="brand-name">Breezy<small>AirGradient</small></div>
        </div>

        <div className="lens-toggle">
          <button className={lens === "you" ? "on" : ""} onClick={() => switchLens("you")}><Icon name="user" size={13} /> You</button>
          <button className={lens === "company" ? "on" : ""} onClick={() => switchLens("company")}><Icon name="building" size={13} /> Company</button>
        </div>

        {lens === "you" ? (
          <div className="nav-group">
            <div className="nav-label">Personal - private</div>
            {navYou.map((n) => (
              <button key={n.id} className={"nav-item" + (view === n.id ? " active" : "")} onClick={() => go(n.id)}>
                <span className="ico"><Icon name={n.icon} size={19} /></span>{n.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="nav-group">
            <div className="nav-label">Company - aggregated</div>
            <button className={"nav-item active"} onClick={() => go("company")}>
              <span className="ico"><Icon name="building" size={19} /></span>Studio overview
            </button>
          </div>
        )}

        <div className="nav-spacer" />
        <div className="divider" />
        <div className="user-card">
          <span className="avatar">{window.initials(store.profile.name)}</span>
          <div><div className="nm">{store.profile.name}</div><div className="rl">{store.profile.team}</div></div>
          <button className="icon-btn" onClick={store.signOut} aria-label="Sign out"><Icon name="x" size={14} /></button>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <div className="row between" style={{ marginBottom: 4 }}>
            <button className="iconbtn menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Icon name="menu" size={18} /></button>
            <div className="row" style={{ gap: 9, marginLeft: "auto" }}>
              <button className="iconbtn" aria-label="Toggle theme" onClick={() => setSettings((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }))}>
                <Icon name={settings.theme === "dark" ? "sun" : "moon"} size={18} />
              </button>
              <button className="iconbtn" aria-label={settings.muted ? "Unmute Breezy" : "Mute Breezy"} onClick={() => setSettings((s) => ({ ...s, muted: !s.muted }))}
                style={settings.muted ? {} : { color: "var(--ag-blue)" }}>
                <Icon name={settings.muted ? "belloff" : "bell"} size={18} />
              </button>
            </div>
          </div>

          {lens === "you" && view === "today" && <TodayView store={store} todayClarity={todayClarity} />}
          {lens === "you" && view === "dashboard" && <PersonalView store={store} todayClarity={todayClarity} goJourney={() => go("journey")} goMedals={() => go("medals")} />}
          {lens === "you" && view === "journey" && <JourneyView store={store} />}
          {lens === "you" && view === "medals" && <MedalsView />}
          {lens === "you" && view === "history" && <HistoryView store={store} />}
          {lens === "you" && view === "settings" && <SettingsView store={store} />}
          {lens === "company" && <CompanyView store={store} />}
        </div>
      </main>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
      {pendingEntry && <FeedbackModal entry={pendingEntry} onSave={(p) => saveFeedback(pendingEntry.id, p)} onSkip={() => saveFeedback(pendingEntry.id, null)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
