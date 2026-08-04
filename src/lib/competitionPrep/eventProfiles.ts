import type { EventType, EventDemandProfile } from "./types";

export const EVENT_DEMAND_PROFILES: Record<EventType, EventDemandProfile> = {
  hyrox: {
    endurance: 5,
    glycogen: 5,
    muscularEndurance: 5,
    maxStrength: 2,
    bodyweightSensitivity: 4,
    fuelingPrecision: 5,
  },
  athx: {
    endurance: 4,
    glycogen: 4,
    muscularEndurance: 4,
    maxStrength: 5,
    bodyweightSensitivity: 3,
    fuelingPrecision: 4,
  },
  "5k": {
    endurance: 3,
    glycogen: 2,
    muscularEndurance: 2,
    maxStrength: 1,
    bodyweightSensitivity: 3,
    fuelingPrecision: 2,
  },
  "10k": {
    endurance: 4,
    glycogen: 3,
    muscularEndurance: 2,
    maxStrength: 1,
    bodyweightSensitivity: 3,
    fuelingPrecision: 3,
  },
  half_marathon: {
    endurance: 4,
    glycogen: 4,
    muscularEndurance: 3,
    maxStrength: 1,
    bodyweightSensitivity: 4,
    fuelingPrecision: 4,
  },
  full_marathon: {
    endurance: 5,
    glycogen: 5,
    muscularEndurance: 3,
    maxStrength: 1,
    bodyweightSensitivity: 4,
    fuelingPrecision: 5,
  },
};

export const EVENT_LABELS: Record<EventType, string> = {
  hyrox: "HYROX",
  athx: "ATHX",
  "5k": "5K",
  "10k": "10K",
  half_marathon: "Half Marathon",
  full_marathon: "Full Marathon",
};

export interface DivisionOption {
  value: string;
  label: string;
}

export const EVENT_DIVISIONS: Record<EventType, DivisionOption[]> = {
  hyrox: [
    { value: "open", label: "Open" },
    { value: "pro", label: "Pro" },
    { value: "doubles", label: "Doubles" },
    { value: "mixed_doubles", label: "Mixed Doubles" },
    { value: "relay", label: "Relay" },
  ],
  athx: [
    { value: "open", label: "Open" },
    { value: "elite", label: "Elite" },
    { value: "age_group", label: "Age Group" },
    { value: "team", label: "Team" },
  ],
  "5k": RACE_DIVISIONS,
  "10k": RACE_DIVISIONS,
  half_marathon: RACE_DIVISIONS,
  full_marathon: RACE_DIVISIONS,
};

export const FALLBACK_DIVISIONS: DivisionOption[] = [
  { value: "individual", label: "Individual" },
  { value: "pairs", label: "Pairs" },
  { value: "team", label: "Team" },
  { value: "open", label: "Open" },
  { value: "elite", label: "Elite" },
  { value: "custom", label: "Custom" },
];

/** Legacy lookup – resolves any division value to a display label */
export const DIVISION_LABELS: Record<string, string> = {
  open: "Open", pro: "Pro", solo: "Solo", doubles: "Doubles",
  mixed_doubles: "Mixed Doubles", team: "Team", relay: "Relay", custom: "Custom",
  individual: "Individual", pairs: "Pairs", mixed_pairs: "Mixed Pairs",
  elite: "Elite", age_group: "Age Group",
  deka_strong: "DEKA STRONG", deka_mile: "DEKA MILE", deka_fit: "DEKA FIT",
  just_finish: "Just Finish", time_goal: "Time Goal", personal_best: "Personal Best",
};

// ── Universal comp goal categories ─────────────────────────────────

export interface CompGoalOption {
  value: string;
  icon: string;
  /** Default label (used when no event override exists) */
  label: string;
  /** Default description */
  desc: string;
}

/** Single source of truth — all events use these same goal values */
export const UNIVERSAL_COMP_GOALS: CompGoalOption[] = [
  { value: "lose_weight", icon: "🔥", label: "Lose Weight", desc: "Get leaner for event day" },
  { value: "improve_performance", icon: "⚡", label: "Improve Performance", desc: "Maximise event-day output" },
  { value: "build_strength", icon: "💪", label: "Build Strength", desc: "Get stronger for the event" },
  { value: "improve_endurance", icon: "🏃", label: "Improve Endurance", desc: "Go longer and harder" },
  { value: "recomp", icon: "🔄", label: "Recomp", desc: "Lose fat while building muscle" },
  { value: "maintain_and_peak", icon: "🎯", label: "Maintain & Peak", desc: "Stay steady and peak for event" },
];

// ── Event-specific display overrides (UI only) ────────────────────

export interface EventGoalOverride {
  label?: string;
  desc?: string;
}

export interface EventGuidance {
  tagline: string;
  /** Optional label/desc overrides keyed by universal goal value */
  goalOverrides?: Record<string, EventGoalOverride>;
}

export const EVENT_GUIDANCE: Record<EventType, EventGuidance> = {
  hyrox: {
    tagline: "HYROX requires strong endurance, pacing, and performance under fatigue.",
    goalOverrides: {
      improve_performance: { label: "Improve Overall Race Performance", desc: "Maximise your HYROX race-day output" },
      improve_endurance: { label: "Improve Endurance & Pacing", desc: "Build race-day stamina and pacing strategy" },
      build_strength: { label: "Build Strength for Stations", desc: "Get stronger for sled, wall balls, and carries" },
      lose_weight: { label: "Lose Weight for Efficiency", desc: "Get leaner to move faster between stations" },
    },
  },
  deka: {
    tagline: "DEKA events require repeated high-intensity efforts across multiple zones.",
    goalOverrides: {
      improve_performance: { label: "Improve Overall Event Performance", desc: "Maximise your overall DEKA score" },
      improve_endurance: { label: "Improve Conditioning Between Zones", desc: "Build capacity between DEKA zones" },
      build_strength: { label: "Build Strength & Power", desc: "Get stronger across all DEKA stations" },
    },
  },
  turf_games: {
    tagline: "Turf Games involve team-based workouts and repeated high-intensity efforts.",
    goalOverrides: {
      improve_performance: { label: "Improve Team Performance", desc: "Be a stronger teammate on event day" },
      build_strength: { label: "Build Strength & Work Capacity", desc: "Handle more volume under fatigue" },
      improve_endurance: { label: "Improve Recovery Between Efforts", desc: "Bounce back faster between events" },
    },
  },
  athx: {
    tagline: "ATHX combines strength, endurance, and recovery across multiple zones.",
    goalOverrides: {
      improve_performance: { label: "Improve Overall Performance", desc: "Maximise your ATHX event-day output" },
      build_strength: { label: "Build Strength Across Zones", desc: "Get stronger for all ATHX challenges" },
      improve_endurance: { label: "Improve Endurance Capacity", desc: "Go longer and harder across zones" },
    },
  },
  metrix: {
    tagline: "Metrix events combine strength, conditioning, and competition-style workouts.",
    goalOverrides: {
      improve_performance: { label: "Improve Competition Performance", desc: "Maximise your Metrix event-day output" },
      improve_endurance: { label: "Improve Conditioning", desc: "Build work capacity and endurance" },
    },
  },
};

/**
 * Resolves display goals for a given event type.
 * Always returns the same universal goal values — only labels/descs change.
 */
export function getCompGoalsForEvent(eventType?: string): CompGoalOption[] {
  const guidance = eventType && EVENT_GUIDANCE[eventType as EventType];
  const overrides = guidance?.goalOverrides ?? {};

  return UNIVERSAL_COMP_GOALS.map((goal) => {
    const ov = overrides[goal.value];
    return ov
      ? { ...goal, label: ov.label ?? goal.label, desc: ov.desc ?? goal.desc }
      : goal;
  });
}
