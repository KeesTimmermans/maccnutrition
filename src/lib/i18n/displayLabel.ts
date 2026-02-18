/**
 * Maps known internal keys to human-readable labels.
 * Add entries here whenever a new key is used in UI text.
 */
const LABEL_MAP: Record<string, string> = {
  // Profile / Baseline Summary
  your_targets: "Your targets",
  cal_day: "Calories per day",
  water_day: "Water per day",
  current_focus: "Current focus",
  primary_goal: "Primary goal",
  fat_loss: "Fat loss",
  muscle_gain: "Muscle gain",
  performance_goal: "Performance",
  performance: "Performance",
  recovery_goal: "Recovery",
  recovery: "Recovery",
  energy_goal: "Energy",
  energy: "Energy",
  health_markers: "Health markers",
  general_health: "General health",
  recomp: "Body recomposition",

  // Goals / activity
  activity_level: "Activity level",
  training_days: "Training days",
  training_intensity: "Training intensity",
  daily_activity_level: "Daily activity level",
  not_active: "Not active",
  semi_active: "Semi-active",
  very_active: "Very active",
  job_activity_level: "Job activity level",

  // Diet / lifestyle
  diet_type: "Diet type",
  meal_prep_time: "Meal prep time",
  meals_per_day: "Meals per day",
  eating_speed: "Eating speed",
  snacking_habits: "Snacking habits",
  emotional_eating: "Emotional eating",
  hunger_patterns: "Hunger patterns",
  energy_patterns: "Energy patterns",
  weekend_habits: "Weekend habits",
  eating_out_frequency: "Eating out frequency",
  cooking_skill: "Cooking skill",
  food_dislikes: "Food dislikes",
  past_diets: "Past diets",
  protein_shakes_preference: "Protein shakes",
  hydration_habits: "Hydration habits",
  cravings_triggers: "Cravings triggers",

  // Health
  stress_level: "Stress level",
  sleep_hours: "Sleep hours",
  body_fat_percentage: "Body fat percentage",
  biggest_challenge: "Biggest challenge",
  cycle_regularity: "Cycle regularity",
  current_phase: "Current phase",
  cycle_symptoms: "Cycle symptoms",

  // Progress
  more_progress: "More progress",
  update_measurements: "Update measurements",
  satisfaction_choice: "Satisfaction",

  // Units
  unit_system: "Unit system",
  preferred_currency: "Preferred currency",
  preferred_language: "Language",
  coaching_tone: "Coaching style",
  dashboard_layout: "Dashboard layout",

  // Measurement fields
  weight: "Weight",
  height_cm: "Height (cm)",
  height_feet: "Height (ft)",
  height_inches: "Height (in)",
  waist_cm: "Waist (cm)",
  hip_cm: "Hip (cm)",
  chest_cm: "Chest (cm)",
  arm_cm: "Arm (cm)",
  neck_cm: "Neck (cm)",
  thigh_cm: "Thigh (cm)",

  // Macro targets
  target_calories: "Calorie target",
  protein_grams: "Protein",
  carbs_grams: "Carbs",
  fats_grams: "Fats",
  water_liters: "Water target",
};

/**
 * Converts a snake_case or kebab-case string to Sentence case.
 * e.g. "fat_loss" → "Fat loss", "health-markers" → "Health markers"
 */
function snakeToSentence(key: string): string {
  return key
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Resolves a key to a human-readable display label.
 *
 * Priority:
 * 1. Explicit LABEL_MAP entry
 * 2. Automatic snake_case → Sentence case conversion
 *
 * This function NEVER returns a string containing underscores.
 *
 * @example
 * toDisplayLabel("your_targets")   // → "Your targets"
 * toDisplayLabel("cal_day")        // → "Calories per day"
 * toDisplayLabel("fat_loss")       // → "Fat loss"
 * toDisplayLabel("unknownKey_abc") // → "Unknownkey abc"
 */
export function toDisplayLabel(key: string): string {
  if (!key) return "";
  return LABEL_MAP[key] ?? snakeToSentence(key);
}
