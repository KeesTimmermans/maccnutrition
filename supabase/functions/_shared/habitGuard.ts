/**
 * Safety net for users on the "simple habits" food approach.
 * Pure TypeScript with no Deno or browser imports, so edge functions and vitest can both use it.
 *
 * Only the prose of a reply is checked and changed: fenced ```json blocks (meal cards) are never touched,
 * because the app still needs their hidden numbers for one-tap logging.
 */

export const HABIT_FALLBACK_LINE = "Thanks — let's keep building your habits.";

const NUTRIENT =
  "(?:protein|proteins|carbs?|carbohydrates?|fats?|sugars?|fib(?:re|er)|prot[eé]ines?|prote[ií]nas?|proteine|glucides|lipides|grasas?|grassi|carboidrati|carboidratos|hidratos|gorduras|zuccheri|az[uú]cares?|sucres?)";
const NUM = "\\d+(?:[.,]\\d+)?";

const NUTRITION_PATTERNS: RegExp[] = [
  /\bk?cals?\b/i,
  /\bkilocalories?\b/i,
  /\bcalori(?:e|es)\b/i,
  /\bcalor[ií]as?\b/i,
  /\bmacros?\b/i,
  /\bmacronutri\w*/i,
  // "30g protein", "25-30 g of protein", "30 grams of carbs", "30 g de proteína"
  new RegExp(`${NUM}\\s?(?:(?:-|–|to)\\s?${NUM}\\s?)?g(?:rams?)?\\b(?:\\s+(?:of|de|di|d'))?\\s+${NUTRIENT}\\b`, "i"),
  // "protein: 30g", "protein of about 30g", "protein (30 g)"
  new RegExp(`\\b${NUTRIENT}\\b\\s*[:=(]?\\s*(?:of\\s+)?(?:around\\s+|about\\s+|~)?${NUM}\\s?g(?:rams?)?\\b`, "i"),
  /\btargets?\b/i,
  // Percentages next to nutrition words, in either order ("80% full" is a hunger cue, not nutrition)
  new RegExp(`${NUM}\\s?%(?!\\s*full)[^.!?\\n]{0,40}\\b(?:${NUTRIENT}|calori\\w*|intake|goal)\\b`, "i"),
  new RegExp(`\\b(?:${NUTRIENT}|calori\\w*|intake|goal)\\b[^.!?\\n]{0,40}${NUM}\\s?%(?!\\s*full)`, "i"),
  /\bd[ée]ficits?\b/i,
  /\bsurplus(?:es)?\b/i,
];

interface Segment {
  json: boolean;
  text: string;
}

/** Splits text into prose and ```json fenced segments; an unclosed fence runs to the end. */
const splitJsonSegments = (text: string): Segment[] => {
  const segments: Segment[] = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("```json", i);
    if (start === -1) {
      segments.push({ json: false, text: text.slice(i) });
      break;
    }
    if (start > i) segments.push({ json: false, text: text.slice(i, start) });
    const end = text.indexOf("```", start + 7);
    if (end === -1) {
      segments.push({ json: true, text: text.slice(start) });
      break;
    }
    segments.push({ json: true, text: text.slice(start, end + 3) });
    i = end + 3;
  }
  return segments;
};

const proseMatches = (text: string): boolean => NUTRITION_PATTERNS.some((re) => re.test(text));

/** True when the prose (outside ```json blocks) mentions calories, macros, nutrient grams, targets, % of nutrition, deficits or surpluses. */
export const containsNutritionNumbers = (text: string | null | undefined): boolean => {
  if (!text) return false;
  return splitJsonSegments(text).some((s) => !s.json && proseMatches(s.text));
};

const stripProse = (text: string): string => {
  const out: string[] = [];
  let droppedPrevious = false;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    // A focus point's "→ how-to" tip goes with its removed focus line.
    if (droppedPrevious && trimmed.startsWith("→")) continue;
    droppedPrevious = false;
    if (!trimmed || !proseMatches(line)) {
      out.push(line);
      continue;
    }
    const kept = trimmed.split(/(?<=[.!?…])\s+/).filter((sentence) => !proseMatches(sentence));
    if (kept.length === 0) {
      droppedPrevious = true;
      continue;
    }
    out.push(kept.join(" "));
  }
  return out.join("\n");
};

/** Removes the sentences (and focus-point lines) that mention nutrition numbers; ```json blocks stay byte-for-byte. */
export const stripNutritionSentences = (text: string): string =>
  splitJsonSegments(text)
    .map((s) => (s.json ? s.text : stripProse(s.text)))
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const hasRealProse = (text: string): boolean =>
  splitJsonSegments(text)
    .filter((s) => !s.json)
    .map((s) => s.text)
    .join("\n")
    .split("\n")
    .some((line) => {
      const t = line.trim();
      return t.length > 0 && !/^---[A-Z_]+---$/.test(t);
    });

/** Strips offending sentences; never returns an empty reply. Keeps any meal-card JSON after the fallback line. */
export const guardHabitReply = (text: string, fallback: string = HABIT_FALLBACK_LINE): string => {
  const stripped = stripNutritionSentences(text);
  if (hasRealProse(stripped)) return stripped;
  const jsonBlocks = splitJsonSegments(stripped).filter((s) => s.json).map((s) => s.text);
  return jsonBlocks.length > 0 ? `${fallback}\n\n${jsonBlocks.join("\n\n")}` : fallback;
};

/** Lines of a context block that are safe to show a habits-mode model (drops any line with nutrition numbers). */
export const dropNutritionLines = (text: string | null | undefined): string =>
  (text || "")
    .split("\n")
    .filter((line) => !proseMatches(line))
    .join("\n");

/** Anything other than 'habits' (including null or errors) means calorie tracking. */
export const isHabitTrackingMode = (value: unknown): boolean => value === "habits";
