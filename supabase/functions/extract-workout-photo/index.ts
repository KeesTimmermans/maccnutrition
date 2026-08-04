import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  imageBase64: z.string()
    .max(10 * 1024 * 1024, "Image too large (max 10MB)")
    .refine(
      (val) => !val || val.startsWith('data:image/') || /^[A-Za-z0-9+/=]+$/.test(val.substring(0, 100)),
      "Invalid image format"
    ),
});

const FALLBACK = {
  exercises: [],
  workoutType: null,
  durationMinutes: null,
  confidence: "low",
  notes: "Couldn't clearly read the photo — add exercises manually below.",
};

const SYSTEM_PROMPT = `You are a fitness assistant that reads photos of handwritten or printed workout notes, training logs, and gym whiteboards, and extracts the structured workout.

You MUST respond with ONLY a JSON object in this exact format:
{
  "exercises": [
    {
      "name": "Exercise name",
      "sets": [{ "reps": number, "weight": number, "unit": "kg" | "lb" }]
    }
  ],
  "workoutType": string or null,
  "durationMinutes": number or null,
  "confidence": "high" | "medium" | "low",
  "notes": "Brief note about anything unclear"
}

Rules:
- Expand shorthand like "3x10 @ 60kg" into three separate sets of 10 reps at 60 kg.
- Use "kg" unless the notes clearly indicate pounds (lb/lbs/#), then use "lb".
- Bodyweight exercises should use weight 0.
- For "workoutType", guess from context using one of: weightlifting, cardio, crossfit, yoga, hiit, swimming, cycling, sports, martial_arts, dance, walking. If you can't tell, use null.
- If nothing is clearly legible, return an empty exercises array with confidence "low".
- Set confidence to "low" whenever handwriting is ambiguous.
Do not include any other text, only the JSON object.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rawBody = await req.json();
    const validationResult = requestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          details: validationResult.error.errors.map((e) => e.message).join(", "),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64 } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Read this photo of workout notes and extract the exercises and sets.",
              },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let result: Record<string, unknown> = FALLBACK;
    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          result = {
            exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
            workoutType: parsed.workoutType ?? null,
            durationMinutes:
              typeof parsed.durationMinutes === "number" ? parsed.durationMinutes : null,
            confidence: ["high", "medium", "low"].includes(parsed.confidence)
              ? parsed.confidence
              : "low",
            notes: typeof parsed.notes === "string" ? parsed.notes : "",
          };
          if ((result.exercises as unknown[]).length === 0) {
            result = { ...result, confidence: "low", notes: result.notes || FALLBACK.notes };
          }
        }
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        result = FALLBACK;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extract-workout-photo error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
