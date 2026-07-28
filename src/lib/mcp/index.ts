import { auth, defineMcp } from "@lovable.dev/mcp-js";
import logMealTool from "./tools/log-meal";
import listMealsTool from "./tools/list-meals";
import logWaterTool from "./tools/log-water";
import getDailySummaryTool from "./tools/get-daily-summary";
import getNutritionTargetsTool from "./tools/get-nutrition-targets";
import getProgressTool from "./tools/get-progress";

// Issuer must be the direct Supabase host, built from the project ref literal.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "macnutrition-mcp",
  title: "MacNutrition",
  version: "0.1.0",
  instructions:
    "Tools for MacNutrition, a UK-first nutrition coaching app. Use `get_nutrition_targets` for the user's daily calorie, macro and hydration targets; `log_meal` and `log_water` to record intake; `list_meals` and `get_daily_summary` to review a day; `get_progress` for recent weight check-ins. All values are metric (grams, ml, kg). Never recalculate the user's targets yourself — read them with `get_nutrition_targets`.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getNutritionTargetsTool,
    getDailySummaryTool,
    listMealsTool,
    logMealTool,
    logWaterTool,
    getProgressTool,
  ],
});
