const PHASE_RULES = [
  { id: "morning", label: "早上", startsAt: 5, endsAt: 12 },
  { id: "afternoon", label: "下午", startsAt: 12, endsAt: 17 },
  { id: "dusk", label: "黄昏", startsAt: 17, endsAt: 22 },
];

export function getTimePhase(date = new Date()) {
  const hour = date.getHours();
  return (
    PHASE_RULES.find((phase) => hour >= phase.startsAt && hour < phase.endsAt) ?? {
      id: "lateNight",
      label: "深夜",
    }
  );
}

export function createTimeSnapshot(date = new Date()) {
  const phase = getTimePhase(date);
  const timeMode = new Set(["morning", "afternoon"]).has(phase.id) ? "day" : "night";
  return {
    date,
    dateLabel: new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
    }).format(date),
    fullDateLabel: new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(date),
    weekdayLabel: new Intl.DateTimeFormat("zh-CN", {
      weekday: "short",
    }).format(date),
    phase: phase.id,
    phaseLabel: phase.label,
    timeMode,
    timeModeLabel: timeMode === "day" ? "白天" : "夜晚",
  };
}

export function createTimeService({ now = () => new Date(), intervalMs = 60_000 } = {}) {
  const listeners = new Set();
  let snapshot = createTimeSnapshot(now());
  let timer = null;

  const notify = () => {
    snapshot = createTimeSnapshot(now());
    for (const listener of listeners) listener(snapshot);
  };

  const handleVisibility = () => {
    if (!document.hidden) notify();
  };

  return {
    getSnapshot() {
      return snapshot;
    },

    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    },

    start() {
      if (timer !== null) return;
      timer = window.setInterval(notify, intervalMs);
      window.addEventListener("focus", notify);
      document.addEventListener("visibilitychange", handleVisibility);
      notify();
    },

    stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      window.removeEventListener("focus", notify);
      document.removeEventListener("visibilitychange", handleVisibility);
    },

    refresh: notify,
  };
}
