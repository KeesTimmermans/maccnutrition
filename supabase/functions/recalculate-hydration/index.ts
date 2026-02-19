import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Retroactive hydration recalculation for all existing users.
 * Applies the Master Hydration System logic server-side.
 *
 * Protected: requires service-role or admin auth.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all user baselines
    const { data: baselines, error: fetchError } = await supabase
      .from("user_baselines")
      .select("user_id, weight, unit_system, age, sex, activity_level, job_activity_level, workout_types, training_days, training_duration, climate, primary_goal, stress_level, sleep_hours, current_phase");

    if (fetchError) {
      throw new Error(`Failed to fetch baselines: ${fetchError.message}`);
    }

    let updated = 0;
    let skipped = 0;
    const missingData: string[] = [];

    for (const b of baselines || []) {
      // Check for required weight
      if (!b.weight) {
        missingData.push(b.user_id);
        skipped++;
        continue;
      }

      // Convert weight to kg
      const unitSystem = b.unit_system || "metric";
      const rawWeight = Number(b.weight);
      const weightKg = unitSystem === "metric" ? rawWeight : rawWeight / 2.205;

      const workoutTypes: string[] = b.workout_types || [];
      const jobActivity = b.job_activity_level || "light";
      const goal = b.primary_goal || "general_health";
      const trainingDays = b.training_days || "2-3";
      const trainingDuration = b.training_duration || "30_60";
      const climate = b.climate || "moderate";
      const sex = b.sex || "male";
      const currentPhase = b.current_phase || "";
      const stressLevel = b.stress_level || "moderate";
      const sleepHours = b.sleep_hours || "7-8";
      const activityLevel = b.activity_level || "semi_active";

      // ── 1. Base hydration rate ──
      const isHighIntensity = workoutTypes.some((t: string) =>
        ["crossfit", "hiit", "martial_arts"].includes(t)
      );
      const isManualOrOutdoor = jobActivity === "active";
      const isFatLoss = goal === "fat_loss";

      let mlPerKg = 35;
      if (isHighIntensity || isFatLoss || isManualOrOutdoor) {
        mlPerKg = 40;
      } else if (
        (activityLevel === "not_active" || activityLevel === "semi_active") &&
        (jobActivity === "sedentary" || jobActivity === "light") &&
        (workoutTypes.length === 0 || workoutTypes.includes("none"))
      ) {
        mlPerKg = 30;
      }

      const baseMl = weightKg * mlPerKg;

      // ── 2. Training addition ──
      let addPerHour = 0;
      if (!workoutTypes.includes("none") && workoutTypes.length > 0) {
        if (workoutTypes.some((t: string) => ["crossfit", "hiit", "martial_arts", "sports"].includes(t))) {
          addPerHour = 500;
        } else if (workoutTypes.some((t: string) => ["weightlifting", "swimming", "cycling", "cardio", "dance"].includes(t))) {
          addPerHour = 400;
        }
      }

      let sessionHours = 1.0;
      if (trainingDuration === "under_30") sessionHours = 0.4;
      else if (trainingDuration === "30_60") sessionHours = 0.75;
      else if (trainingDuration === "60_90") sessionHours = 1.25;
      else if (trainingDuration === "over_90") sessionHours = 1.75;

      const trainingAddMl = Math.round(addPerHour * sessionHours);

      let dailyTrainingFraction = 0;
      if (trainingDays === "0-1") dailyTrainingFraction = 0.14;
      else if (trainingDays === "2-3") dailyTrainingFraction = 0.36;
      else if (trainingDays === "4-5") dailyTrainingFraction = 0.64;
      else if (trainingDays === "6+") dailyTrainingFraction = 0.86;

      let totalDailyMl = baseMl + trainingAddMl * dailyTrainingFraction;

      // ── 3. Climate ──
      if (climate === "hot") totalDailyMl += 500;

      // ── 4. Female cycle ──
      if (sex === "female" && (currentPhase === "luteal" || currentPhase === "menstrual")) {
        totalDailyMl *= 1.15;
      }

      // ── 5. Electrolytes ──
      const needsElectrolyteFocus =
        totalDailyMl > 3000 || isHighIntensity || trainingDays === "6+" || trainingDays === "4-5";

      let sodiumMg = needsElectrolyteFocus ? 3000 : 2500;
      let magnesiumMg = 350;
      const potassiumMg = 2750;

      if (stressLevel === "high" || sleepHours === "<5" || sleepHours === "5-6") {
        magnesiumMg += 75;
      }
      if (trainingDays === "6+" || climate === "hot") {
        sodiumMg += 500;
      }

      const waterLiters = Math.round((totalDailyMl / 1000) * 10) / 10;

      // Update
      const { error: updateError } = await supabase
        .from("user_baselines")
        .update({
          water_liters: waterLiters,
          sodium_mg: Math.round(sodiumMg),
          magnesium_mg: Math.round(magnesiumMg),
          potassium_mg: Math.round(potassiumMg),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", b.user_id);

      if (updateError) {
        console.error(`Failed to update ${b.user_id}:`, updateError.message);
        skipped++;
      } else {
        updated++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        skipped,
        missingDataUserIds: missingData,
        total: (baselines || []).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Recalculation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
