/* AirGradient - Today / Track view */
const { useState: useToday, useEffect: useTodayE } = React;

function EntryRow({ e, onDelete }) {
  const t = window.taskOf(e.taskId) || { title: e._draftTitle || "Task", categoryId: e._draftCat || "other" };
  const c = window.catOf(t.categoryId) || window.catOf("other");
  const flowClass = e.feedback ? (e.feedback.flowQuality === "Great flow" ? "tag-flow-great" : e.feedback.flowQuality === "Friction" ? "tag-flow-friction" : "tag-flow-neutral") : "";
  return (
    <div className="entry">
      <span className="cat-dot" style={{ background: c.color + "1f", color: c.color }}><CatIcon id={c.icon} size={17} /></span>
      <div className="e-main">
        <div className="e-title">{t.title}
          {e.isManual && <span className="tag-mini tag-manual"><Icon name="rewind" size={10} /> Manual</span>}
          {e.isEdited && <span className="tag-mini">Edited</span>}
          {e.feedback && <span className={"tag-mini " + flowClass}>{e.feedback.flowQuality}</span>}
          {e.blockers.filter((b) => b !== "none").length > 0 && <span className="tag-mini tag-block"><Icon name="flag" size={10} /> {e.blockers.filter((b) => b !== "none").length}</span>}
        </div>
        <div className="e-meta">
          <span className="mono">{window.startToClock(e.start)}-{window.startToClock(e.start + e.dur)}</span>
          <span>-</span><span>{c.name}</span>
          {e.contextSwitches > 0 && <><span>-</span><span>{e.contextSwitches} switches</span></>}
          {e.feedback && e.feedback.note && <span style={{ fontStyle: "italic", color: "var(--text-faint)" }}>- "{e.feedback.note}"</span>}
        </div>
      </div>
      <span className="e-dur">{window.fmtHM(e.dur)}</span>
      <div className="e-actions">
        {onDelete && <button className="icon-btn" onClick={onDelete} aria-label="Delete entry"><Icon name="trash" size={14} /></button>}
      </div>
    </div>
  );
}

function Collaborators({ taskId, currentUserId, entries }) {
  const AG = window.AG;
  const task = taskId ? window.taskOf(taskId) : AG.tasks.find((t) => t.isShared && (t.members || []).includes(currentUserId));
  if (!task || !(task.members || []).length) return null;
  const members = [...new Set([task.ownerId, ...(task.members || [])])];
  const mins = {};
  let total = 0;
  entries.filter((e) => e.taskId === task.id).forEach((e) => { mins[e.userId] = (mins[e.userId] || 0) + e.dur; total += e.dur; });
  return (
    <div className="card pad">
      <div className="card-h"><h3>Collaborators - {task.title}</h3><span className="sub">{window.fmtHM(total)} combined</span></div>
      {members.map((uid) => {
        const u = window.userOf(uid); if (!u) return null;
        const m = mins[uid] || 0; const pct = total ? Math.round(m / total * 100) : 0;
        const isLive = uid === currentUserId && task.id === taskId;
        return (
          <div className="collab" key={uid}>
            <span className="av">{window.initials(u.name)}</span>
            <span className="nm">{u.name.split(" ")[0]} {isLive && <span className="live-chip"><span className="d" />now</span>}</span>
            <span className="barwrap"><span className="f" style={{ width: pct + "%" }} /></span>
            <span className="pct">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function SharedTasks({ store }) {
  const uid = store.currentUser.id;
  const tasks = window.AG.tasks
    .filter((task) => task.ownerId !== uid && (task.members || []).includes(uid) && !task.isArchived)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 5);
  if (!tasks.length) return null;

  const selectTask = (task) => {
    store.setTimer((timer) => ({
      ...timer,
      taskId: task.id,
      draft: { ...timer.draft, title: task.title, categoryId: task.categoryId || timer.draft.categoryId },
    }));
    store.pushToast({ mood: "happy", title: "Shared task selected", body: "Start it when you are ready to track your own progress.", force: true });
  };

  return (
    <div className="card pad shared-tasks" style={{ marginBottom: 16 }}>
      <div className="card-h"><h3>Shared with you</h3><span className="sub">{tasks.length} active</span></div>
      {tasks.map((task) => {
        const owner = window.userOf(task.ownerId);
        const cat = window.catOf(task.categoryId) || window.catOf("other");
        const taskEntries = store.entries.filter((entry) => entry.taskId === task.id);
        const total = taskEntries.reduce((sum, entry) => sum + entry.dur, 0);
        const mine = taskEntries.filter((entry) => entry.userId === uid).reduce((sum, entry) => sum + entry.dur, 0);
        const selected = store.timer.taskId === task.id;
        return (
          <div className="shared-task-row" key={task.id}>
            <span className="cat-dot" style={{ background: cat.color + "1f", color: cat.color }}><CatIcon id={cat.icon} size={17} /></span>
            <div className="shared-task-main">
              <b>{task.title}</b>
              <div className="muted">{owner ? "Invited by " + owner.name : "Shared task"} - {cat.name}</div>
            </div>
            <div className="shared-task-progress">
              <span>{window.fmtHM(mine)} mine</span>
              <b>{window.fmtHM(total)} team</b>
            </div>
            <button className={"btn sm" + (selected ? " primary" : "")} onClick={() => selectTask(task)}>
              <Icon name={selected ? "check" : "play"} size={14} /> {selected ? "Selected" : "Track"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ShareTaskModal({ taskId, onClose, store }) {
  const [members, setMembers] = useToday([]);
  const [busy, setBusy] = useToday(false);
  const [error, setError] = useToday("");
  const task = window.taskOf(taskId);
  useTodayE(() => {
    let cancelled = false;
    store.fetchSignedInMembers().then((rows) => { if (!cancelled) setMembers(rows); }).catch((e) => setError(e.message));
    return () => { cancelled = true; };
  }, [taskId]);
  const existing = new Set(task?.members || []);
  const invite = async (userId) => {
    setBusy(true); setError("");
    try { await store.shareTask(taskId, userId); onClose(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <div><h3>Share task</h3><div className="muted" style={{ fontSize: 13 }}>{task?.title || "Current task"}</div></div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Only users who have signed in can be invited.</div>
        <div className="grid" style={{ gap: 10 }}>
          {members.map((u) => (
            <div className="member-row" key={u.id}>
              <span className="avatar">{window.initials(u.name)}</span>
              <div style={{ minWidth: 0 }}><b>{u.name}</b><div className="muted" style={{ fontSize: 12 }}>{u.email} - {u.team}</div></div>
              <button className="btn sm" disabled={busy || existing.has(u.id)} onClick={() => invite(u.id)}>{existing.has(u.id) ? "Added" : "Invite"}</button>
            </div>
          ))}
          {!members.length && <div className="empty-state"><div className="et">No signed-in members yet.</div><div className="es">Ask another user to sign in, then reopen Share.</div></div>}
        </div>
        {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  );
}

function TodayView({ store, todayClarity }) {
  const AG = window.AG;
  const { entries, categories, settings, timer, setDraft, nowSec, ctxSwitches, idleSec,
    startTimer, takeBreak, resume, stopTimer, deleteEntry } = store;
  const [manual, setManual] = useToday(false);
  const [newCat, setNewCat] = useToday(false);
  const [shareOpen, setShareOpen] = useToday(false);
  const uid = store.currentUser.id;

  const todays = entries.filter((e) => e.userId === uid && e.date === AG.TODAY_KEY).sort((a, b) => a.start - b.start);
  const liveMin = timer.running ? nowSec / 60 : 0;
  const todayTotal = todays.reduce((s, e) => s + e.dur, 0) + liveMin;
  const clk = window.fmtClock(timer.running ? nowSec : 0);
  const cat = categories.find((c) => c.id === timer.draft.categoryId) || categories[0];

  const mood = window.companionMood({ running: timer.running, elapsedSec: nowSec, paused: timer.paused, todayClarity, muted: settings.muted });
  let say = "Ready when you are. What's first today?";
  let sub = "Name a task and press start to begin.";
  if (timer.paused) { say = "Take a breath."; sub = "Drink some water - Breezy will keep your spot."; }
  else if (timer.running && nowSec > 45 * 60) { say = "You're deep in the zone."; sub = "Beautiful focus. Remember to come up for air."; }
  else if (timer.running) { say = "Tracking - I've got the count."; sub = "Working on " + (timer.draft.title || cat.name) + "."; }
  else if (todayTotal >= 360) { say = "A full, clear-air day."; sub = "Maybe wind down soon - rest counts too."; }
  else if (todayTotal > 0) { say = "Nice momentum today."; sub = window.fmtHM(todayTotal) + " tracked so far."; }

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">Personal - private</div>
          <div className="page-title">Track</div>
          <div className="page-sub">{AG.TODAY.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
        </div>
        <PrivacyPill lens="you" />
      </div>

      {!settings.muted && (
        <div className="breezy" style={{ marginBottom: 16 }}>
          <Breezy mood={mood} size={58} />
          <div><div className="breezy-say">{say}</div><div className="breezy-sub">{sub}</div></div>
        </div>
      )}

      <div className="card timer-hero" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ alignItems: "flex-start", gap: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="timer-state">
              <span className={"pulse" + (timer.running && !timer.paused ? " live" : "")} />
              {timer.paused ? "On a break" : timer.running ? "Tracking" : "Ready"}
            </div>
            <div className="timer-display" style={{ marginTop: 10 }}>
              {clk.h !== "00" && <>{clk.h}<span className="ms">:</span></>}{clk.m}<span className="ms">:</span>{clk.s}
            </div>
            <input className="input" style={{ marginTop: 16, maxWidth: 440 }} placeholder="What are you working on?"
              value={timer.draft.title} onChange={(e) => setDraft({ title: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && !timer.running && timer.draft.title.trim()) startTimer(); }} />
          </div>
          {!timer.running ? (
            <button className="timer-btn" onClick={() => { if (!startTimer()) store.pushToast({ mood: "thinking", title: "Add a task name first", body: "Breezy needs a task before tracking.", force: true }); }} aria-label="Start timer"><Icon name="play" size={24} /></button>
          ) : (
            <button className="timer-btn running" onClick={stopTimer} aria-label="Finish task and log session"><Icon name="stop" size={22} /></button>
          )}
        </div>

        <div className="row wrap" style={{ gap: 8, marginTop: 18 }}>
          {categories.map((c) => (
            <button key={c.id} className={"chip" + (timer.draft.categoryId === c.id ? " sel" : "")} onClick={() => setDraft({ categoryId: c.id })}>
              <span className="gi" style={{ color: c.color }}><CatIcon id={c.icon} size={15} /></span>{c.name}
            </button>
          ))}
          {newCat ? (
            <input className="input" autoFocus style={{ width: 150 }} placeholder="New category..."
              onKeyDown={async (e) => { if (e.key === "Enter" && e.target.value.trim()) { const id = await store.addCategory(e.target.value.trim()); setDraft({ categoryId: id }); setNewCat(false); } if (e.key === "Escape") setNewCat(false); }}
              onBlur={() => setNewCat(false)} />
          ) : (
            <button className="chip" onClick={() => setNewCat(true)}><Icon name="plus" size={14} /> Add</button>
          )}
        </div>

        <div className="row between wrap" style={{ marginTop: 18, gap: 12 }}>
          <div className="row" style={{ gap: 8 }}>
            {timer.running && (timer.paused
              ? <button className="btn primary sm" onClick={resume}><Icon name="play" size={15} /> Resume</button>
              : <button className="btn sm" onClick={takeBreak}><Icon name="coffee" size={15} /> Take a Break</button>)}
            {timer.running && <button className="btn sm" onClick={() => setShareOpen(true)}><Icon name="user" size={15} /> Share</button>}
            {timer.running && <button className="btn orange sm" onClick={stopTimer}><Icon name="check" size={15} /> Task Done</button>}
            {!timer.running && <button className="btn sm" onClick={() => setManual(true)}><Icon name="rewind" size={15} /> Retroactive entry</button>}
          </div>
          {timer.running && (
            <div className="row" style={{ gap: 14, fontSize: 12.5, color: "var(--text-mut)", fontWeight: 600 }}>
              <span className="row" style={{ gap: 5 }}><Icon name="switch" size={14} /> {ctxSwitches} switches</span>
              <span className="row" style={{ gap: 5 }}><Icon name="idle" size={14} /> {Math.round(idleSec / 60)}m idle</span>
            </div>
          )}
        </div>
      </div>

      <SharedTasks store={store} />

      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="card-h"><h3>Today's entries</h3><span className="sub mono">{window.fmtHM(todays.reduce((s, e) => s + e.dur, 0))} - {todays.length} {todays.length === 1 ? "session" : "sessions"}</span></div>
        {todays.length === 0 ? (
          <div className="empty-state">
            <Breezy mood="sleepy" size={86} />
            <div className="et">No tracked time yet today.</div>
            <div className="es">Add a task to begin. Breezy is ready when you are.</div>
          </div>
        ) : todays.map((e) => <EntryRow key={e.id} e={e} onDelete={() => deleteEntry(e.id)} />)}
      </div>

      <Collaborators taskId={timer.taskId} currentUserId={uid} entries={entries} />

      {shareOpen && timer.taskId && <ShareTaskModal taskId={timer.taskId} store={store} onClose={() => setShareOpen(false)} />}
      {manual && <ManualEntryModal categories={categories} onClose={() => setManual(false)} onSave={(e) => { store.addManualEntry(e); setManual(false); }} />}
    </div>
  );
}
window.TodayView = TodayView;
