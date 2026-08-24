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

export function createTimeSnapshot(date = new Date(), locale = "zh-CN") {
  const phase = getTimePhase(date);
  const timeMode = DAY_TIME_PHASE_IDS.includes(phase.id) ? "day" : "night";
  const english = String(locale).toLowerCase().startsWith("en");
  const phaseLabels = {
    morning: "Morning",
    afternoon: "Afternoon",
    dusk: "Dusk",
    lateNight: "Late night",
  };
  const dateLocale = english ? "en" : "zh-CN";
  return {
    date,
    dateLabel: new Intl.DateTimeFormat(dateLocale, {
      month: "numeric",
      day: "numeric",
    }).format(date),
    fullDateLabel: new Intl.DateTimeFormat(dateLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(date),
    weekdayLabel: new Intl.DateTimeFormat(dateLocale, {
      weekday: "short",
    }).format(date),
    phase: phase.id,
    phaseLabel: english ? phaseLabels[phase.id] : phase.label,
    timeMode,
    timeModeLabel: english ? (timeMode === "day" ? "Daytime" : "Night") : (timeMode === "day" ? "白天" : "夜晚"),
  };
}

export function createTimeService({
  now = () => new Date(),
  intervalMs = 60_000,
  getLocale = () => globalThis.document?.documentElement?.lang ?? "zh-CN",
} = {}) {
  const listeners = new Set();
  let snapshot = createTimeSnapshot(now(), getLocale());
  let timer = null;

  const notify = () => {
    snapshot = createTimeSnapshot(now(), getLocale());
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
