/* AirGradient — feedback + manual-entry modals */
const { useState: useFb } = React;

const FLOW_OPTS = [
  { v: "Great flow", ei: "🌊" }, { v: "Neutral", ei: "🌥️" }, { v: "Friction", ei: "🌬️" },
];
const EFF_OPTS = [
  { v: "Felt efficient", ei: "⚡" }, { v: "Felt manual", ei: "🔧" }, { v: "Felt wasteful", ei: "🌀" },
];
const ENERGY_OPTS = [
  { v: "High", ei: "🔋" }, { v: "OK", ei: "🙂" }, { v: "Drained", ei: "🪫" },
];

function FbRow({ label, opts, value, onChange }) {
  return (
    <div className="fb-group">
      <div className="lbl">{label}</div>
      <div className="fb-opts" role="radiogroup" aria-label={label}>
        {opts.map((o) => (
          <button key={o.v} role="radio" aria-checked={value === o.v}
            className={"fb-opt" + (value === o.v ? " sel" : "")} onClick={() => onChange(o.v)}>
            <span className="ei" aria-hidden="true">{o.ei}</span>{o.v}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedbackModal({ entry, onSave, onSkip }) {
  const [flow, setFlow] = useFb("Great flow");
  const [eff, setEff] = useFb("Felt efficient");
  const [energy, setEnergy] = useFb("OK");
  const [note, setNote] = useFb("");
  const [blockers, setBlockers] = useFb([]);
  const toggle = (id) => setBlockers((b) => id === "none" ? (b.includes("none") ? [] : ["none"]) : (b.includes(id) ? b.filter((x) => x !== id) : [...b.filter((x) => x !== "none"), id]));

  return (
    <div className="modal-scrim" onClick={onSkip}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <h3>Session complete — how did it feel?</h3>
          <Breezy mood="thinking" size={44} />
        </div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>Optional, but it teaches Breezy your rhythm. {entry && entry._draftTitle ? "“" + entry._draftTitle + "”" : ""}</p>

        <FbRow label="Flow quality" opts={FLOW_OPTS} value={flow} onChange={setFlow} />
        <FbRow label="Efficiency feel" opts={EFF_OPTS} value={eff} onChange={setEff} />
        <FbRow label="Energy" opts={ENERGY_OPTS} value={energy} onChange={setEnergy} />

        <div className="fb-group">
          <div className="lbl">Blockers <span className="muted" style={{ fontWeight: 500 }}>· multi-select</span></div>
          <div className="blk-grid">
            {window.AG.blockerDefs.map((b) => (
              <button key={b.id} className={"blk" + (blockers.includes(b.id) ? " sel" : "")}
                aria-pressed={blockers.includes(b.id)} onClick={() => toggle(b.id)}>
                <span className="cb">{blockers.includes(b.id) && <Icon name="check" size={11} stroke="2.5" />}</span>{b.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <label>Note <span className="muted" style={{ fontWeight: 500 }}>· optional</span></label>
          <textarea className="input" rows="2" placeholder="A note to your future self…" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="row between">
          <button className="btn ghost" onClick={onSkip}>Skip</button>
          <button className="btn primary" onClick={() => onSave({ flow, eff, energy, note: note.trim(), blockers })}>
            <Icon name="check" size={15} /> Save session
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualEntryModal({ onSave, onClose, categories }) {
  const AG = window.AG;
  const [f, setF] = useFb(() => ({ title: "", categoryId: "deep", date: AG.TODAY_KEY, startH: 9, startM: 0, dur: 60 }));
  const set = (p) => setF((s) => ({ ...s, ...p }));
  const save = () => {
    if (!f.title.trim()) return;
    // find or synthesize a task id
    const existing = AG.tasks.find((t) => t.title.toLowerCase() === f.title.trim().toLowerCase());
    onSave({ taskId: existing ? existing.id : "draft", date: f.date, start: f.startH * 60 + Number(f.startM),
      dur: Number(f.dur), _draftTitle: f.title.trim(), _draftCat: f.categoryId,
      feedback: { flowQuality: "Neutral", efficiencyFeel: "Felt manual", energy: "OK", note: "Retroactive entry" } });
  };
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 18 }}>
          <h3>Retroactive entry</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="grid" style={{ gap: 14 }}>
          <div className="field"><label>What did you work on?</label>
            <input className="input" value={f.title} placeholder="Task name" onChange={(e) => set({ title: e.target.value })} /></div>
          <div className="field"><label>Category</label>
            <div className="row wrap" style={{ gap: 8 }}>
              {categories.map((c) => (
                <button key={c.id} className={"chip" + (f.categoryId === c.id ? " sel" : "")} onClick={() => set({ categoryId: c.id })}>
                  <span className="gi" style={{ color: c.color }}><CatIcon id={c.icon} size={15} /></span>{c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <div className="field" style={{ flex: 1 }}><label>Date</label>
              <input className="input" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></div>
            <div className="field" style={{ width: 120 }}><label>Start</label>
              <input className="input mono" type="time" value={String(f.startH).padStart(2, "0") + ":" + String(f.startM).padStart(2, "0")}
                onChange={(e) => { const [h, m] = e.target.value.split(":").map(Number); set({ startH: h, startM: m }); }} /></div>
            <div className="field" style={{ width: 100 }}><label>Minutes</label>
              <input className="input mono" type="number" min="5" step="5" value={f.dur} onChange={(e) => set({ dur: e.target.value })} /></div>
          </div>
        </div>
        <div className="row between" style={{ marginTop: 22 }}>
          <span className="tag-mini tag-manual"><Icon name="rewind" size={11} /> Flagged manual</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}><Icon name="check" size={15} /> Add entry</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.FeedbackModal = FeedbackModal;
window.ManualEntryModal = ManualEntryModal;
