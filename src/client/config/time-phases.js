export const TIME_PHASE_RULES = Object.freeze(
  [
    { id: "morning", label: "早上", startsAt: 5, endsAt: 12 },
    { id: "afternoon", label: "下午", startsAt: 12, endsAt: 17 },
    { id: "dusk", label: "黄昏", startsAt: 17, endsAt: 22 },
  ].map(Object.freeze),
);

export const FALLBACK_TIME_PHASE = Object.freeze({ id: "lateNight", label: "深夜" });

export const DAY_TIME_PHASE_IDS = Object.freeze(["morning", "afternoon"]);
