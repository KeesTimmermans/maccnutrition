/**
 * Predefined coaching message templates for Competition Prep.
 *
 * Every message the user sees is selected from this file based on
 * trigger conditions — no free-form AI generation.
 *
 * Rules:
 *  - 1–2 sentences max
 *  - Explain WHAT changed and WHY
 *  - Sound like a coach, not a system log
 *  - No algorithmic / technical language
 */

import type { PrepPhase, NutritionMode, CompGoal, EventType } from "./types";

// ── Phase explanations (shown when plan is created or phase changes) ───

export function getPhaseExplanation(
  phase: PrepPhase,
  mode: NutritionMode,
  goal: CompGoal,
  weeksOut: number,
  eventLabel: string,
): string {
  // Race week
  if (phase === "race_week") {
    return `It's race week — your nutrition is locked in to keep you fuelled and feeling good for ${eventLabel}.`;
  }

  // Taper
  if (phase === "taper") {
    return `You're tapering into ${eventLabel}. Calories are back near maintenance so your body can recover and perform.`;
  }

  // Performance protection (2-3 weeks out)
  if (phase === "performance_protection") {
    return `Your event is close, so we've shifted focus to protecting your training quality and energy levels.`;
  }

  // Specific prep with fat loss
  if (mode === "fat_loss" && phase === "specific_prep") {
    return `You're ${weeksOut} weeks out from ${eventLabel}. We're keeping a gentle deficit so you can still train hard while losing weight steadily.`;
  }

  // General fat loss (build / foundation)
  if (mode === "fat_loss") {
    return `With ${weeksOut} weeks until ${eventLabel}, your plan has a moderate deficit with enough carbs and protein to support your training.`;
  }

  // Peak mode
  if (mode === "peak") {
    return `Your plan is set up to peak for ${eventLabel} — calories are slightly above maintenance to top up your energy stores.`;
  }

  // Strength support
  if (mode === "strength_support") {
    return `Your plan prioritises strength gains with ${weeksOut} weeks until ${eventLabel}. As the event gets closer, we'll shift toward performance.`;
  }

  // Performance build
  if (mode === "performance_build") {
    return `Your plan supports steady performance improvement heading into ${eventLabel}. It'll adapt automatically as race day gets closer.`;
  }

  // Recomp
  if (mode === "recomp") {
    return `Your plan balances muscle retention with gradual fat loss over the next ${weeksOut} weeks before ${eventLabel}.`;
  }

  // Fallback (should rarely fire)
  return `Your plan is set for ${weeksOut} weeks of preparation for ${eventLabel}. It will adjust as the event gets closer.`;
}

// ── Weekly adjustment reason templates ──────────────────────────────

export const ADJUSTMENT_TEMPLATES = {
  // Weight-loss rate
  losingTooFast:
    "You're losing weight faster than planned, so we've added some calories back to keep your energy and performance on track.",
  losingTooSlow:
    "Weight loss has slowed despite good consistency, so we've trimmed calories slightly to get things moving again.",
  losingSlowLowAdherence:
    "Weight hasn't shifted much, but your consistency could improve — focus on hitting your targets more often before we change anything.",

  // Performance / recovery
  performanceDeclining:
    "Your performance has dipped, so we've added extra carbs around training to help you bounce back.",
  poorRecovery:
    "Recovery feels low, so we've eased the deficit and added some carbs to help your body repair.",
  highHungerNearEvent:
    "Hunger is high and the event is close — we've moved you closer to maintenance so you can focus on feeling ready.",

  // Timeline override
  timelineOverride:
    "You're less than 3 weeks out, so we're prioritising performance over fat loss — no calorie cuts from here.",

  // No change
  noChange:
    "Everything looks on track this week — keep doing what you're doing.",
} as const;

// ── Goal weight realism messages ────────────────────────────────────

export function getGoalWeightWarning(
  requiredPerWeek: number,
  realisticLow: number,
  realisticHigh: number,
): string {
  return `That target would need you to lose about ${requiredPerWeek.toFixed(1)} kg per week, which is too aggressive for maintaining performance. A more realistic race-day weight would be around ${realisticHigh.toFixed(1)}–${realisticLow.toFixed(1)} kg.`;
}

export const GOAL_WEIGHT_TOO_CLOSE =
  "You're too close to the event for deliberate weight loss — the focus now is on fuelling performance.";

// ── Taper guidance messages ─────────────────────────────────────────

export function getTaperMessages(isGISensitive: boolean): string[] {
  return [
    "Calories are moving back toward maintenance to let your body recover.",
    "Any aggressive fat loss has stopped — this isn't the time for big deficits.",
    "Protein stays the same to protect your muscle and recovery.",
    "Carbs may increase slightly if your training sessions are still demanding.",
    isGISensitive
      ? "If you're prone to gut issues, consider easing off high-fibre foods this week."
      : "Keep your diet consistent — no big changes this close to race day.",
  ];
}

export function getRaceWeekMessages(needsCarbLoading: boolean): string[] {
  const messages = [
    "Stick with foods you know — this isn't the week to try anything new.",
    "Keep your fluid intake steady and consistent.",
    "Avoid big cheat meals or large calorie swings — your body wants routine.",
    "Prioritise sleep, digestion, and keeping sodium consistent.",
  ];
  if (needsCarbLoading) {
    messages.push("Increase carbs modestly in the final day or two to top up your fuel stores.");
    messages.push("Cut back on very high-fibre or high-fat meals if gut comfort is a concern.");
  }
  return messages;
}

// ── Hydration coaching messages ─────────────────────────────────────

export const HYDRATION_TAPER_MESSAGES: string[] = [
  "Pay extra attention to hydration this week — it matters more than ever.",
  "Keep your fluid and sodium intake consistent each day.",
  "Don't try to water-load — steady sipping is better than flooding.",
  "Add electrolytes during long or hot training sessions.",
];
