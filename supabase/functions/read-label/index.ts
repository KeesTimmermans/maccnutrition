import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const DAILY_LIMIT = 10;

const BodySchema = z.object({
  imageBase64: z.string()
    .min(1)
    .max(10 * 1024 * 1024, "Image too large (max 10MB)")
    .refine(
      (val) => val.startsWith("data:image/") || /^[A-Za-z0-9+/=]+$/.test(val.substring(0, 100)),
      "Invalid image format",
    ),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PROMPT = `You read food packaging nutrition labels. Look at the photo and return ONLY a JSON object, no prose, no code fences.
Never guess or estimate. Use null for anything not clearly visible on the label.
If the photo is not a readable nutrition label, return {"readable": false}.
Otherwise return:
{"readable": true,
 "productName": string|null,
 "per100gOrPerServing": "per100g"|"perServing",
 "servingSizeG": number|null,
 "sugarsG": number|null, "saturatedFatG": number|null, "saltG": number|null, "sodiumG": number|null,
 "fibreG": number|null, "proteinG": number|null, "fatG": number|null, "carbsG": number|null,
 "energyKcal": number|null,
 "ingredientsText": string|null}
Prefer the per 100g column when both are shown. Numbers in grams (energy in kcal). Copy ingredientsText verbatim.`;

const numOrNull = z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v),
  z.number().finite().nonnegative().nullable().catch(null)).optional().transform((v) => v ?? null);
const strOrNull = z.string().nullable().optional().catch(null).transform((v) => (v && v.trim()) || null);

const ReadingSchema = z.object({
  productName: strOrNull,
  per100gOrPerServing: z.enum(["per100g", "perServing"]).catch("per100g"),
  servingSizeG: numOrNull, sugarsG: numOrNull, saturatedFatG: numOrNull, saltG: numOrNull,
  sodiumG: numOrNull, fibreG: numOrNull, proteinG: numOrNull, fatG: numOrNull, carbsG: numOrNull,
  energyKcal: numOrNull, ingredientsText: strOrNull,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: authError } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authError || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.errors.map((e) => e.message).join(", ") }, 400);
    }

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = new Date().toISOString().slice(0, 10);
    const { count, error: countError } = await admin.from("label_reads")
      .select("id", { count: "exact", head: true }).eq("user_id", userId).eq("read_date", today);
    if (countError) throw countError;
    if ((count ?? 0) >= DAILY_LIMIT) return json({ error: "daily_limit", limit: DAILY_LIMIT }, 429);
    await admin.from("label_reads").insert({ user_id: userId, read_date: today });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
    const image = parsed.data.imageBase64.startsWith("data:")
      ? parsed.data.imageBase64 : `data:image/jpeg;base64,${parsed.data.imageBase64}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [{ role: "user", content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: image } },
        ] }],
      }),
    });
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      if (res.status === 429) return json({ error: "rate_limited" }, 429);
      if (res.status === 402) return json({ error: "credits" }, 402);
      return json({ error: "ai_error" }, 502);
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    let raw: Record<string, unknown> | null = null;
    try { raw = match ? JSON.parse(match[0]) : null; } catch { raw = null; }
    if (!raw || raw.readable === false) return json({ readable: false });
    const reading = ReadingSchema.parse(raw);
    return json({ readable: true, ...reading });
  } catch (e) {
    console.error("read-label error", e);
    return json({ error: "Something went wrong" }, 500);
  }
});
