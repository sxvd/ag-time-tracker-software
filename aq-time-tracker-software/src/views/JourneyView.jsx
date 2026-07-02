/* AirGradient - Breezy Journey roadmap */
const { useMemo: useJourneyMemo, useState: useJourneyState } = React;

const JOURNEY_Y = [66, 48, 42, 58, 72, 70, 61, 46, 43, 50, 64, 68];
const JOURNEY_MOODS_BY_CATEGORY = {
  deep: ["focused", "engineer", "cheering"],
  meeting: ["waving", "notification", "coffee"],
  admin: ["book", "reading", "idle"],
  comms: ["waving", "notification", "happy"],
  research: ["reading", "thinking", "engineer"],
  other: ["idle", "coffee", "thinking"],
};

function journeyDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function journeyKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addJourneyDays(key, days) {
  const d = journeyDate(key);
  d.setDate(d.getDate() + days);
  return journeyKey(d);
}

function mondayKey(key) {
  const d = journeyDate(key);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return journeyKey(d);
}

function monthName(key) {
  return journeyDate(key).toLocaleDateString("en-US", { month: "long" });
}

function compactDate(key) {
  return journeyDate(key).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function weekOfMonth(key) {
  const d = journeyDate(key);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const firstMondayOffset = (first.getDay() + 6) % 7;
  return Math.ceil((d.getDate() + firstMondayOffset) / 7);
}

function moodFromScore(score) {
  if (score >= 85) return "happy";
  if (score >= 70) return "engineer";
  if (score >= 55) return "focused";
  if (score >= 40) return "thinking";
  if (score >= 25) return "haze-low";
  return "haze-high";
}

function journeyLabel(point) {
  if (point.clarity >= 82) return ["Bright", "best day"];
  if (point.great >= 2) return ["Clear", "deep work"];
  if (point.blocked >= 2) return ["Cloudy", "small blockers"];
  if (point.total >= 300) return ["Light", "easy handoff"];
  if (point.total >= 150) return ["Calm", "steady focus"];
  return ["Settled", "good rhythm"];
}

function journeyIconMood({ categoryId, clarity, blocked, great, index }) {
  if (blocked >= 2) return index % 2 ? "haze-low" : "thinking";
  if (clarity >= 85) return index % 2 ? "cheering" : "happy";
  if (great >= 2) return index % 2 ? "engineer" : "focused";
  const moods = JOURNEY_MOODS_BY_CATEGORY[categoryId] || JOURNEY_MOODS_BY_CATEGORY.other;
  return moods[index % moods.length];
}

function buildJourney(store) {
  const AG = window.AG;
  const uid = store.currentUser.id;
  const end = mondayKey(AG.TODAY_KEY);
  const weeks = Array.from({ length: 12 }, (_, i) => addJourneyDays(end, (i - 11) * 7));
  const entriesByWeek = new Map(weeks.map((week) => [week, []]));
  const userEntries = store.entries.filter((e) => e.userId === uid);
  userEntries.forEach((entry) => {
    const week = mondayKey(entry.date);
    if (entriesByWeek.has(week)) entriesByWeek.get(week).push(entry);
  });

  const points = weeks.map((week, index) => {
    const weekEntries = entriesByWeek.get(week) || [];
    const weekKeys = Array.from({ length: 7 }, (_, day) => addJourneyDays(week, day));
    const breezyRows = weekKeys.map((key) => AG.breezyDays[key]).filter(Boolean);
    const byTask = {};
    weekEntries.forEach((entry) => {
      byTask[entry.taskId] = (byTask[entry.taskId] || 0) + entry.dur;
    });
    const topTaskId = Object.keys(byTask).sort((a, b) => byTask[b] - byTask[a])[0];
    const task = window.taskOf(topTaskId) || { title: "Tracked work", categoryId: "other" };
    const category = window.catOf(task.categoryId) || window.catOf("other");
    const total = weekEntries.reduce((sum, entry) => sum + entry.dur, 0);
    const great = weekEntries.filter((entry) => entry.feedback?.flowQuality === "Great flow").length;
    const blocked = weekEntries.filter((entry) => (entry.blockers || []).filter((b) => b !== "none").length).length;
    const clarity = breezyRows.length
      ? Math.round(breezyRows.reduce((sum, row) => sum + row.airClarity, 0) / breezyRows.length)
      : Math.max(12, Math.min(100, Math.round((total / 60 / 7) * 55 + great * 14 - blocked * 8 + 30)));
    const [title, subtitle] = journeyLabel({ total, great, blocked, clarity });
    const mood = journeyIconMood({ categoryId: category.id, clarity, blocked, great, index }) || breezyRows[0]?.mood || moodFromScore(clarity);
    const accent = category.color || "#1C75BC";
    return {
      week,
      index,
      total,
      great,
      blocked,
      clarity,
      mood,
      task,
      category,
      accent,
      softAccent: accent + "24",
      topMinutes: topTaskId ? byTask[topTaskId] : 0,
      title,
      subtitle,
      x: 9 + index * (82 / 11),
      y: JOURNEY_Y[index],
      hasMemory: total > 0,
    };
  });

  const months = [];
  weeks.forEach((week, index) => {
    const name = monthName(week);
    const current = months[months.length - 1];
    if (!current || current.name !== name) months.push({ name, start: index, end: index });
    else current.end = index;
  });

  return { weeks, points, months, memories: points.filter((point) => point.hasMemory) };
}

function JourneyView({ store }) {
  const journey = useJourneyMemo(() => buildJourney(store), [store.entries, store.currentUser.id]);
  const [selected, setSelected] = useJourneyState(null);
  const saved = journey.memories.length;
  const cards = journey.memories.slice(0, 6);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-l">
          <div className="eyebrow">Personal - private</div>
          <div className="page-title">Breezy Journey</div>
          <div className="page-sub">A roadmap of your weekly Breezy memories, built from tracked task data.</div>
        </div>
        <PrivacyPill lens="you" />
      </div>

      <div className="card pad journey-card">
        <div className="journey-head">
          <div>
            <h3>Breezy Journey</h3>
            <p>A calm look back at weekly Breezy days, moods, and clear-air moments.</p>
          </div>
          <div className="seg journey-tabs" aria-label="Journey tabs">
            <button className="on">Timeline</button>
            <button>Calendar</button>
            <button>Moods</button>
          </div>
        </div>

        <div className="journey-filters">
          <div className="journey-month-pills">
            {journey.months.map((month) => <button className="journey-month-pill" key={month.name}>{month.name}</button>)}
          </div>
          <div className="journey-saved">{saved} Breezy days saved</div>
        </div>

        <div className="journey-roadmap">
          {journey.months.map((month, idx) => {
            const left = month.start * (100 / 12);
            const width = (month.end - month.start + 1) * (100 / 12);
            return (
              <div className={"journey-month-band band-" + (idx % 3)} key={month.name} style={{ left: left + "%", width: width + "%" }}>
                <div className="journey-month-title">{month.name}</div>
              </div>
            );
          })}

          <div className="journey-card-row">
            {cards.map((point) => (
              <button
                className="journey-note"
                key={point.week}
                style={{ "--journey-accent": point.accent, "--journey-soft": point.softAccent }}
                onClick={() => setSelected(point)}
              >
                <i className="journey-note-dot" />
                <span>{point.title}</span>
                <b>{point.subtitle}</b>
              </button>
            ))}
          </div>

          <svg className="journey-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className="journey-road-base" d="M5 64 C18 48 26 36 38 53 S58 75 70 53 S85 36 95 59" />
            <path className="journey-road-dash" d="M5 64 C18 48 26 36 38 53 S58 75 70 53 S85 36 95 59" />
          </svg>

          {journey.memories.map((point) => (
            <button
              className="journey-marker"
              key={point.week}
              style={{ left: point.x + "%", top: point.y + "%", "--journey-accent": point.accent, "--journey-soft": point.softAccent }}
              onClick={() => setSelected(point)}
              aria-label={`Open ${point.task.title}`}
            >
              <span className="journey-stem" />
              <span className="journey-marker-ring" />
              <Breezy mood={point.mood} size={52} />
            </button>
          ))}

          <div className="journey-week-axis">
            {journey.weeks.map((week) => (
              <div className="journey-week" key={week}>
                <span />
                <b>W{weekOfMonth(week)}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="journey-legend">
          <span><i style={{ background: "#1C75BC" }} /> Deep work</span>
          <span><i style={{ background: "#2aa6a0" }} /> Clear air</span>
          <span><i style={{ background: "#e0a43b" }} /> Admin</span>
          <span><i style={{ background: "#d67459" }} /> Friction</span>
          <strong>Each Breezy holds a saved task memory</strong>
        </div>
      </div>

      {!journey.memories.length && (
        <div className="empty-state card pad">
          <Breezy mood="sleepy" size={86} />
          <div className="et">No Journey memories yet.</div>
          <div className="es">Track a task and Breezy will add the next saved point.</div>
        </div>
      )}

      {selected && (
        <div className="modal-scrim" onClick={() => setSelected(null)}>
          <div className="modal journey-memory-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row between" style={{ marginBottom: 16 }}>
              <div>
                <h3>{selected.task.title}</h3>
                <div className="muted" style={{ fontSize: 13 }}>{compactDate(selected.week)} week memory</div>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}><Icon name="x" size={16} /></button>
            </div>
            <div className="journey-memory-hero" style={{ "--journey-accent": selected.accent, "--journey-soft": selected.softAccent }}>
              <Breezy mood={selected.mood} size={84} />
              <div>
                <div className="breezy-say">{selected.title}</div>
                <div className="breezy-sub">{selected.subtitle}</div>
              </div>
            </div>
            <div className="journey-memory-grid">
              <div><span>Task</span><b>{selected.task.title}</b></div>
              <div><span>Category</span><b>{selected.category.name}</b></div>
              <div><span>Task time</span><b>{window.fmtHM(selected.topMinutes)}</b></div>
              <div><span>Week total</span><b>{window.fmtHM(selected.total)}</b></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.JourneyView = JourneyView;
