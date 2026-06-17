import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Retroactive hydration recalculation for all existing users.
 * Dynamic Hydration Window System: 30–40 ml/kg.
 * water_liters = lower bound, water_liters_training = upper bound.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // SECURITY: admin/cron-only. Require service-role bearer to prevent any
  // internet caller from triggering a mass rewrite of every user's hydration.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
    console.warn("[RECALC-HYDRATION] Unauthorized request blocked");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);


    const { data: baselines, error: fetchError } = await supabase
      .from("user_baselines")
      .select("user_id, weight, unit_system, training_days, workout_types, training_duration, climate, stress_level, sleep_hours");

    if (fetchError) {
      throw new Error(`Failed to fetch baselines: ${fetchError.message}`);
    }

    let updated = 0;
    let skipped = 0;
    const missingData: string[] = [];

    for (const b of baselines || []) {
      if (!b.weight) {
        missingData.push(b.user_id);
        skipped++;
        continue;
      }

      const unitSystem = b.unit_system || "metric";
      const rawWeight = Number(b.weight);
      const weightKg = unitSystem === "metric" ? rawWeight : rawWeight / 2.205;

      // Fixed window: 30–40 ml/kg
      const lowerMl = weightKg * 30;
      const upperMl = weightKg * 40;
      const lowerLiters = Math.round((lowerMl / 1000) * 10) / 10;
      const upperLiters = Math.round((upperMl / 1000) * 10) / 10;

      const workoutTypes: string[] = b.workout_types || [];
      const trainingDays = b.training_days || "2-3";
      const climate = b.climate || "moderate";
      const stressLevel = b.stress_level || "moderate";
      const sleepHours = b.sleep_hours || "7-8";

      const isHighIntensity = workoutTypes.some((t: string) =>
        ["crossfit", "hiit", "martial_arts"].includes(t)
      );
      const hasTraining = trainingDays !== "0-1" &&
        workoutTypes.length > 0 &&
        !workoutTypes.includes("none");

      // Electrolytes
      const peakMl = upperMl;
      const needsElectrolyteFocus =
        peakMl > 3000 || isHighIntensity || trainingDays === "6+" || trainingDays === "4-5";

      let sodiumMg = needsElectrolyteFocus ? 3000 : 2500;
      let magnesiumMg = 350;
      const potassiumMg = 2750;

      if (stressLevel === "high" || sleepHours === "<5" || sleepHours === "5-6") {
        magnesiumMg += 75;
      }
      if (trainingDays === "6+" || climate === "hot") {
        sodiumMg += 500;
      }

      const { error: updateError } = await supabase
        .from("user_baselines")
        .update({
          water_liters: lowerLiters,
          water_liters_training: upperLiters,
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
