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

export const DIVISION_LABELS: Record<string, string> = {
  open: "Open",
  pro: "Pro",
  solo: "Solo",
  doubles: "Doubles",
  mixed_doubles: "Mixed Doubles",
  team: "Team",
  relay: "Relay",
  custom: "Custom",
};
