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
  deka: {
    endurance: 3,
    glycogen: 3,
    muscularEndurance: 4,
    maxStrength: 2,
    bodyweightSensitivity: 3,
    fuelingPrecision: 3,
  },
  turf_games: {
    endurance: 3,
    glycogen: 4,
    muscularEndurance: 4,
    maxStrength: 4,
    bodyweightSensitivity: 3,
    fuelingPrecision: 4,
  },
  athx: {
    endurance: 4,
    glycogen: 4,
    muscularEndurance: 4,
    maxStrength: 5,
    bodyweightSensitivity: 3,
    fuelingPrecision: 4,
  },
  metrix: {
    endurance: 3,
    glycogen: 3,
    muscularEndurance: 4,
    maxStrength: 3,
    bodyweightSensitivity: 3,
    fuelingPrecision: 3,
  },
};

export const EVENT_LABELS: Record<EventType, string> = {
  hyrox: "HYROX",
  athx: "ATHX",
  metrix: "Metrix",
  turf_games: "Turf Games",
  deka: "DEKA",
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
  deka: [
    { value: "deka_strong", label: "DEKA STRONG" },
    { value: "deka_mile", label: "DEKA MILE" },
    { value: "deka_fit", label: "DEKA FIT" },
    { value: "age_group", label: "Age Group" },
    { value: "elite", label: "Elite" },
  ],
  turf_games: [
    { value: "individual", label: "Individual" },
    { value: "pairs", label: "Pairs" },
    { value: "mixed_pairs", label: "Mixed Pairs" },
    { value: "team", label: "Team" },
    { value: "elite", label: "Elite" },
  ],
  athx: [
    { value: "open", label: "Open" },
    { value: "elite", label: "Elite" },
    { value: "age_group", label: "Age Group" },
    { value: "team", label: "Team" },
  ],
  metrix: [
    { value: "individual", label: "Individual" },
    { value: "pairs", label: "Pairs" },
    { value: "team", label: "Team" },
    { value: "elite", label: "Elite" },
  ],
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
};

// ── Event-specific onboarding context ──────────────────────────────

export interface EventGuidance {
  tagline: string;
  compGoals: { label: string; desc: string; value: string; icon: string }[];
}

export const EVENT_GUIDANCE: Record<EventType, EventGuidance> = {
  hyrox: {
    tagline: "HYROX requires strong endurance, pacing, and performance under fatigue.",
    compGoals: [
      { label: "Improve Endurance & Pacing", desc: "Build race-day stamina and pacing strategy", value: "improve_endurance", icon: "🏃" },
      { label: "Improve Performance", desc: "Maximise your HYROX race-day output", value: "improve_performance", icon: "⚡" },
      { label: "Lose Weight for Efficiency", desc: "Get leaner to move faster between stations", value: "lose_weight", icon: "🔥" },
      { label: "Build Strength for Stations", desc: "Get stronger for sled, wall balls, and carries", value: "build_strength", icon: "💪" },
      { label: "Maintain & Peak", desc: "Stay steady and peak for race day", value: "maintain_and_peak", icon: "🎯" },
    ],
  },
  deka: {
    tagline: "DEKA events require repeated high-intensity efforts across multiple zones.",
    compGoals: [
      { label: "Improve Conditioning", desc: "Build capacity between DEKA zones", value: "improve_endurance", icon: "🏃" },
      { label: "Build Strength & Power", desc: "Get stronger across all DEKA stations", value: "build_strength", icon: "💪" },
      { label: "Improve Performance", desc: "Maximise your overall DEKA score", value: "improve_performance", icon: "⚡" },
      { label: "Lose Weight", desc: "Get leaner for event day", value: "lose_weight", icon: "🔥" },
      { label: "Maintain & Peak", desc: "Stay steady and peak for your event", value: "maintain_and_peak", icon: "🎯" },
    ],
  },
  turf_games: {
    tagline: "Turf Games involve team-based workouts and repeated high-intensity efforts.",
    compGoals: [
      { label: "Improve Team Performance", desc: "Be a stronger teammate on event day", value: "improve_performance", icon: "👥" },
      { label: "Build Strength & Work Capacity", desc: "Handle more volume under fatigue", value: "build_strength", icon: "💪" },
      { label: "Improve Recovery Between Efforts", desc: "Bounce back faster between events", value: "improve_endurance", icon: "🔄" },
      { label: "Lose Weight", desc: "Get leaner for event day", value: "lose_weight", icon: "🔥" },
      { label: "Maintain & Peak", desc: "Stay steady and peak for your event", value: "maintain_and_peak", icon: "🎯" },
    ],
  },
  athx: {
    tagline: "ATHX combines strength, endurance, and recovery across multiple zones.",
    compGoals: [
      { label: "Improve Overall Performance", desc: "Maximise your ATHX event-day output", value: "improve_performance", icon: "⚡" },
      { label: "Build Strength Across Zones", desc: "Get stronger for all ATHX challenges", value: "build_strength", icon: "💪" },
      { label: "Improve Endurance Capacity", desc: "Go longer and harder across zones", value: "improve_endurance", icon: "🏃" },
      { label: "Lose Weight", desc: "Get leaner for event day", value: "lose_weight", icon: "🔥" },
      { label: "Maintain & Peak", desc: "Stay steady and peak for your event", value: "maintain_and_peak", icon: "🎯" },
    ],
  },
  metrix: {
    tagline: "Metrix events combine strength, conditioning, and competition-style workouts.",
    compGoals: [
      { label: "Improve Performance", desc: "Maximise your Metrix event-day output", value: "improve_performance", icon: "⚡" },
      { label: "Build Strength", desc: "Get stronger for competition workouts", value: "build_strength", icon: "💪" },
      { label: "Improve Conditioning", desc: "Build work capacity and endurance", value: "improve_endurance", icon: "🏃" },
      { label: "Lose Weight", desc: "Get leaner for event day", value: "lose_weight", icon: "🔥" },
      { label: "Maintain & Peak", desc: "Stay steady and peak for your event", value: "maintain_and_peak", icon: "🎯" },
    ],
  },
};

export const FALLBACK_COMP_GOALS = [
  { label: "Lose Weight", desc: "Get leaner for event day", value: "lose_weight", icon: "🔥" },
  { label: "Improve Performance", desc: "Maximise event-day output", value: "improve_performance", icon: "⚡" },
  { label: "Build Strength", desc: "Get stronger for the event", value: "build_strength", icon: "💪" },
  { label: "Improve Endurance", desc: "Go longer and harder", value: "improve_endurance", icon: "🏃" },
  { label: "Recomp", desc: "Lose fat while building muscle", value: "recomp", icon: "🔄" },
  { label: "Maintain & Peak", desc: "Stay steady and peak for event", value: "maintain_and_peak", icon: "🎯" },
];
