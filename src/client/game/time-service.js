import {
  DAY_TIME_PHASE_IDS,
  FALLBACK_TIME_PHASE,
  TIME_PHASE_RULES,
} from "../config/time-phases.js";

export function getTimePhase(date = new Date()) {
  const hour = date.getHours();
  return (
    TIME_PHASE_RULES.find((phase) => hour >= phase.startsAt && hour < phase.endsAt) ??
    FALLBACK_TIME_PHASE
  );
}

export function createTimeSnapshot(date = new Date()) {
  const phase = getTimePhase(date);
  const timeMode = DAY_TIME_PHASE_IDS.includes(phase.id) ? "day" : "night";
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
