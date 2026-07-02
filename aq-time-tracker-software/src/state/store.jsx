/* AirGradient - API-backed app store. window.useAGStore */
const { useState: uS, useEffect: uE, useRef: uR, useCallback: uC } = React;

function applyBootstrap(next) {
  if (!next) return;
  Object.assign(window.AG, next);
  window.AG.TODAY = window.AG.TODAY || new Date(2026, 5, 10);
  window.AG.dateKey = window.AG.dateKey || ((d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"));
  window.AG.DAY = window.AG.DAY || 86400000;
}

const sessionTokenStore = {
  get() {
    localStorage.removeItem("ag-session-token");
    return sessionStorage.getItem("ag-session-token") || "";
  },
  set(token) {
    localStorage.removeItem("ag-session-token");
    sessionStorage.setItem("ag-session-token", token);
  },
  clear() {
    localStorage.removeItem("ag-session-token");
    sessionStorage.removeItem("ag-session-token");
  }
};

function useAGStore() {
  const AG = window.AG;
  const [token, setToken] = uS(() => sessionTokenStore.get());
  const [currentUser, setCurrentUser] = uS(null);
  const [loading, setLoading] = uS(true);
  const [authError, setAuthError] = uS("");
  const [entries, setEntries] = uS(() => AG.entries.slice());
  const [categories, setCategories] = uS(() => AG.categories.slice());
  const [settings, setSettingsState] = uS(() => ({ ...AG.settings }));
  const [profile, setProfileState] = uS(() => ({ name: AG.me.name, team: AG.me.team, email: AG.me.email }));
  const [toasts, setToasts] = uS([]);
  const toastId = uR(1);

  const [timer, setTimer] = uS({
    running: false, paused: false, startEpoch: null, pausedAccum: 0, pauseStart: null,
    activeSessionId: "", taskId: "", draft: { title: "", categoryId: "deep" }
  });
  const [nowSec, setNowSec] = uS(0);
  const [ctxSwitches, setCtxSwitches] = uS(0);
  const [idleSec, setIdleSec] = uS(0);
  const [pendingFeedback, setPendingFeedback] = uS(null);
  const tick = uR(null);
  const lastNudge = uR(0);

  function syncFromBootstrap(bootstrap) {
    applyBootstrap(bootstrap);
    setEntries(bootstrap.entries || []);
    setCategories(bootstrap.categories || []);
    setSettingsState({ ...(bootstrap.settings || {}) });
    setProfileState({ name: bootstrap.me.name, team: bootstrap.me.team, email: bootstrap.me.email });
    setCurrentUser(bootstrap.me);
  }

  const request = (path, options = {}) => {
    const transport = window.__AG_STANDALONE__ && window.__agMockFetch ? window.__agMockFetch : fetch;
    return transport(path, options);
  };

  async function api(path, options = {}) {
    const res = await request(path, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: "Bearer " + token } : {}),
        ...(options.headers || {}),
      },
    });
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  uE(() => {
    let cancelled = false;
    async function boot() {
      if (!token) { setLoading(false); return; }
      try {
        const bootstrap = await api("/api/bootstrap");
        if (!cancelled) syncFromBootstrap(bootstrap);
      } catch {
        sessionTokenStore.clear();
        if (!cancelled) { setToken(""); setCurrentUser(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    boot();
    return () => { cancelled = true; };
  }, [token]);

  uE(() => { document.documentElement.setAttribute("data-theme", settings.theme || "light"); }, [settings.theme]);
  uE(() => {
    window.AG.entries = entries;
    window.AG.categories = categories;
    if (currentUser) window.AG.me = { id: currentUser.id, email: currentUser.email, name: profile.name, team: profile.team };
  }, [entries, categories, currentUser, profile]);

  async function signIn(email, password) {
    setAuthError("");
    try {
      const next = await request("/api/auth/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data;
      });
      sessionTokenStore.set(next.token);
      setToken(next.token);
      syncFromBootstrap(next.bootstrap);
      pushToast({ mood: "waving", title: "Welcome back", body: "Your sessions are loaded from the database.", force: true });
      return true;
    } catch (error) {
      setAuthError(error.message);
      return false;
    }
  }

  async function signUp(payload) {
    setAuthError("");
    try {
      const next = await request("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data;
      });
      sessionTokenStore.set(next.token);
      setToken(next.token);
      syncFromBootstrap(next.bootstrap);
      return true;
    } catch (error) {
      setAuthError(error.message);
      return false;
    }
  }

  async function signOut() {
    try { await api("/api/auth/signout", { method: "POST", body: "{}" }); } catch {}
    sessionTokenStore.clear();
    setToken("");
    setCurrentUser(null);
  }

  function pushToast(t) {
    if (settings.muted && !t.force) return;
    const id = toastId.current++;
    setToasts((ts) => [...ts, { id, ...t }]);
  }
  const dismissToast = uC((id) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const setDraft = uC((p) => setTimer((t) => ({ ...t, draft: { ...t.draft, ...p } })), []);

  uE(() => {
    if (!timer.running || timer.paused) return;
    const run = () => {
      const raw = Math.floor((Date.now() - timer.startEpoch - timer.pausedAccum) / 1000);
      setNowSec(Math.max(0, raw));
      const mins = raw / 60;
      if (!settings.muted && mins - lastNudge.current >= (settings.nudgeCadence || 90)) {
        lastNudge.current = mins;
        pushToast({ mood: "location", title: "Time to open a window", body: "You've tracked " + Math.round(mins) + " min - a little fresh air helps focus." });
      }
      tick.current = setTimeout(run, 500);
    };
    run();
    return () => clearTimeout(tick.current);
  }, [timer.running, timer.paused, timer.startEpoch, timer.pausedAccum, settings.muted, settings.nudgeCadence]);

  uE(() => {
    const onVis = () => { if (document.hidden && timer.running && !timer.paused) setCtxSwitches((c) => c + 1); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [timer.running, timer.paused]);

  function startTimer() {
    const title = timer.draft.title.trim();
    if (!title) return false;
    setNowSec(0); setCtxSwitches(0); setIdleSec(0); lastNudge.current = 0;
    setTimer((t) => ({ ...t, running: true, paused: false, startEpoch: Date.now(), pausedAccum: 0, pauseStart: null }));
    api("/api/timer/start", { method: "POST", body: JSON.stringify({ title, categoryId: timer.draft.categoryId, taskId: timer.taskId }) })
      .then((res) => {
        if (res.task && !window.AG.tasks.some((t) => t.id === res.task.id)) window.AG.tasks.push(res.task);
        setTimer((t) => ({ ...t, activeSessionId: res.activeSessionId, taskId: res.taskId }));
      })
      .catch((error) => {
        pushToast({ mood: "thinking", title: "Could not start task", body: error.message, force: true });
        setTimer((t) => ({ ...t, running: false, paused: false, startEpoch: null }));
      });
    if (!settings.muted) pushToast({ mood: "focused", title: "You've got this", body: "Breezy's keeping count. One task at a time." });
    return true;
  }

  function takeBreak() {
    setTimer((t) => ({ ...t, paused: true, pauseStart: Date.now() }));
    pushToast({ mood: "coffee", title: "Take a break", body: "Don't forget to drink water while you're away.", force: true });
  }
  function resume() {
    setTimer((t) => ({ ...t, paused: false, pausedAccum: t.pausedAccum + (Date.now() - (t.pauseStart || Date.now())), pauseStart: null }));
  }
  async function stopTimer() {
    if (!timer.activeSessionId) {
      pushToast({ mood: "thinking", title: "Session is still starting", body: "Try again in a moment.", force: true });
      return;
    }
    try {
      const res = await api("/api/timer/stop", {
        method: "POST",
        body: JSON.stringify({
          activeSessionId: timer.activeSessionId,
          durationSeconds: Math.max(60, nowSec),
          idleSeconds: idleSec,
          contextSwitches: ctxSwitches,
          locationLabel: settings.locationEnabled ? "Office" : "",
        }),
      });
      syncFromBootstrap(res.bootstrap);
      setTimer((t) => ({ ...t, running: false, paused: false, startEpoch: null, activeSessionId: "", taskId: res.entry.taskId }));
      setPendingFeedback(res.entry.id);
      clearTimeout(tick.current);
    } catch (error) {
      pushToast({ mood: "thinking", title: "Could not stop task", body: error.message, force: true });
    }
  }

  async function saveFeedback(entryId, payload) {
    try {
      const feedback = payload ? { flowQuality: payload.flow, efficiencyFeel: payload.eff, energy: payload.energy, note: payload.note } : null;
      const res = await api("/api/entries/" + entryId, { method: "PATCH", body: JSON.stringify({ feedback, blockers: payload ? payload.blockers : [] }) });
      syncFromBootstrap(res.bootstrap);
      setPendingFeedback(null);
      if (payload && payload.flow === "Great flow") pushToast({ mood: "cheering", title: "Clear-sky work!", body: "That was a great-flow session. Breezy's proud." });
      else if (payload) pushToast({ mood: "happy", title: "Session saved", body: "Thanks for the honest signal." });
      setTimer((t) => ({ ...t, draft: { title: "", categoryId: t.draft.categoryId }, taskId: "" }));
    } catch (error) {
      pushToast({ mood: "thinking", title: "Could not save feedback", body: error.message, force: true });
    }
  }

  async function addManualEntry(e) {
    const payload = {
      ...e,
      title: e._draftTitle || e.title,
      categoryId: e._draftCat || e.categoryId,
      feedback: e.feedback || { flowQuality: "Neutral", efficiencyFeel: "Felt manual", energy: "OK", note: "Retroactive entry" },
    };
    const res = await api("/api/manual-entry", { method: "POST", body: JSON.stringify(payload) });
    syncFromBootstrap(res.bootstrap);
    pushToast({ mood: "book", title: "Manual entry added", body: "Clearly flagged as retroactive." });
  }

  const updateEntry = uC(async (id, patch) => {
    const res = await api("/api/entries/" + id, { method: "PATCH", body: JSON.stringify(patch) });
    syncFromBootstrap(res.bootstrap);
  }, [token]);
  const deleteEntry = uC(async (id) => {
    const res = await api("/api/entries/" + id, { method: "DELETE" });
    syncFromBootstrap(res.bootstrap);
  }, [token]);

  async function addCategory(name) {
    const res = await api("/api/categories", { method: "POST", body: JSON.stringify({ name }) });
    syncFromBootstrap(res.bootstrap);
    return res.category.id;
  }

  function setSettings(next) {
    setSettingsState((old) => {
      const updated = typeof next === "function" ? next(old) : { ...old, ...next };
      api("/api/settings", { method: "PATCH", body: JSON.stringify(updated) }).then((res) => syncFromBootstrap(res.bootstrap)).catch(() => {});
      return updated;
    });
  }

  function setProfile(next) {
    setProfileState((old) => {
      const updated = typeof next === "function" ? next(old) : { ...old, ...next };
      api("/api/profile", { method: "PATCH", body: JSON.stringify(updated) }).then((res) => syncFromBootstrap(res.bootstrap)).catch(() => {});
      return updated;
    });
  }

  async function fetchSignedInMembers() {
    return (await api("/api/members")).members;
  }
  async function shareTask(taskId, userId) {
    const res = await api("/api/tasks/" + taskId + "/share", { method: "POST", body: JSON.stringify({ userId }) });
    syncFromBootstrap(res.bootstrap);
    pushToast({ mood: "happy", title: "Task invitation sent", body: "The collaborator can now track this task." });
  }

  async function exportData(format) {
    const res = await request("/api/export?format=" + format, { headers: { authorization: "Bearer " + token } });
    if (!res.ok) return pushToast({ mood: "thinking", title: "Export failed", body: "Please sign in again.", force: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "json" ? "breezy-export.json" : "breezy-export.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    pushToast({ mood: "happy", title: "Exported " + format.toUpperCase(), body: "Pulled from the database - it's yours to keep." });
  }

  return {
    loading, currentUser, authError, signIn, signUp, signOut,
    entries, categories, settings, setSettings, profile, setProfile, toasts, pushToast, dismissToast,
    timer, setTimer, setDraft, nowSec, ctxSwitches, idleSec, pendingFeedback, setPendingFeedback,
    startTimer, takeBreak, resume, stopTimer, saveFeedback, addManualEntry, updateEntry, deleteEntry, addCategory,
    fetchSignedInMembers, shareTask, exportData
  };
}
window.useAGStore = useAGStore;
