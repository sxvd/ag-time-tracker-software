/* AirGradient — Breezy mascot (real PNG art) + mood logic + toast host */

const BREEZY_SRC = Object.assign({
  idle:        "/assets/breezy/idle.png",
  happy:       "/assets/breezy/happy.png",
  cheering:    "/assets/breezy/cheering.png",
  waving:      "/assets/breezy/waving.png",
  focused:     "/assets/breezy/focused.png",
  thinking:    "/assets/breezy/thinking.png",
  sleepy:      "/assets/breezy/sleepy.png",
  coffee:      "/assets/breezy/coffee.png",
  break:       "/assets/breezy/coffee.png",
  engineer:    "/assets/breezy/engineer.png",
  notification:"/assets/breezy/notification.png",
  "haze-low":  "/assets/breezy/haze-low.png",
  "haze-high": "/assets/breezy/haze-high.png",
  mask:        "/assets/breezy/mask.png",
  location:    "/assets/breezy/location.png",
  reading:     "/assets/breezy/reading.png",
  book:        "/assets/breezy/book.png",
}, window.__BZ_URIS || {});

function Breezy({ mood = "idle", size = 56, style, className, alt }) {
  const src = BREEZY_SRC[mood] || BREEZY_SRC.idle;
  return <img src={src} width={size} height={size} className={className}
    style={{ borderRadius: 14, ...style }} alt={alt || ("Breezy — " + mood)} draggable="false" />;
}

// air-clarity score → mood (the AirGradient metaphor: hazier = worse air)
function moodForClarity(c) {
  if (c >= 85) return "happy";
  if (c >= 70) return "engineer";
  if (c >= 55) return "focused";
  if (c >= 40) return "thinking";
  if (c >= 25) return "haze-low";
  return "haze-high";
}

// pick the companion mood from live app state
function companionMood({ running, elapsedSec, paused, todayClarity, muted }) {
  if (muted) return "idle";
  if (paused) return "coffee";
  if (running) {
    if (elapsedSec > 90 * 60) return "thinking";      // long stretch — nudge incoming
    if (elapsedSec > 45 * 60) return "cheering";       // in the zone
    return "focused";
  }
  if (todayClarity != null) return moodForClarity(todayClarity);
  return "waving";
}

// ---- Toast host (Breezy nudges; polite live region) ----
const { useState: useToastState, useEffect: useToastEffect } = React;
function ToastHost({ toasts, onDismiss }) {
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toasts.map((t) => (
        <BreezyToast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
function BreezyToast({ toast, onDismiss }) {
  useToastEffect(() => {
    const ms = toast.duration || 6000;
    const h = setTimeout(onDismiss, ms);
    return () => clearTimeout(h);
  }, []);
  return (
    <div className="toast">
      <Breezy mood={toast.mood || "waving"} size={46} />
      <div>
        <div className="tt">{toast.title}</div>
        {toast.body && <div className="ts">{toast.body}</div>}
      </div>
      <button className="tx icon-btn" aria-label="Dismiss Breezy" onClick={onDismiss}>
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

Object.assign(window, { Breezy, BREEZY_SRC, moodForClarity, companionMood, ToastHost });
