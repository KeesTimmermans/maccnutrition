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
