/**
 * Splits a coach message into its prose and any fenced ```json ... ``` blocks
 * (meal cards). Used so tone rewrites only touch the prose and the cards survive unchanged.
 */
export function splitJsonBlocks(content: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  const text = content
    .replace(/```json\s*[\s\S]*?```/g, (block) => {
      blocks.push(block);
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, blocks };
}
