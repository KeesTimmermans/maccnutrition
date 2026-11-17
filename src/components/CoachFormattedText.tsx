import { Fragment } from "react";

export interface CoachSegment {
  text: string;
  bold: boolean;
}

export type CoachBlock =
  | { kind: "heading"; segments: CoachSegment[] }
  | { kind: "bullet"; segments: CoachSegment[] }
  | { kind: "text"; segments: CoachSegment[] }
  | { kind: "gap" };

/** Splits **bold** spans into segments and drops any leftover unmatched "**". */
export const parseInline = (line: string): CoachSegment[] => {
  const segments: CoachSegment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    if (match.index > last) segments.push({ text: line.slice(last, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < line.length) segments.push({ text: line.slice(last), bold: false });
  return segments
    .map((s) => ({ ...s, text: s.text.replace(/\*\*/g, "") }))
    .filter((s) => s.text.length > 0);
};

/** Turns a coach reply into simple display blocks: headings, bullets, text lines and gaps. */
export const parseCoachText = (text: string): CoachBlock[] => {
  const blocks: CoachBlock[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      if (blocks.length > 0 && blocks[blocks.length - 1].kind !== "gap") blocks.push({ kind: "gap" });
      continue;
    }
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", segments: parseInline(heading[1]) });
      continue;
    }
    const bullet = line.match(/^(?:\* |- |• )(.*)$/);
    if (bullet) {
      blocks.push({ kind: "bullet", segments: parseInline(bullet[1]) });
      continue;
    }
    blocks.push({ kind: "text", segments: parseInline(line) });
  }
  while (blocks.length > 0 && blocks[blocks.length - 1].kind === "gap") blocks.pop();
  return blocks;
};

const Segments = ({ segments }: { segments: CoachSegment[] }) => (
  <>
    {segments.map((s, i) =>
      s.bold ? <strong key={i} className="font-semibold">{s.text}</strong> : <Fragment key={i}>{s.text}</Fragment>,
    )}
  </>
);

export const CoachFormattedText = ({ text }: { text: string }) => {
  const blocks = parseCoachText(text);
  return (
    <div className="text-sm break-words">
      {blocks.map((block, i) => {
        if (block.kind === "gap") return <div key={i} className="h-2" aria-hidden="true" />;
        if (block.kind === "heading") {
          return (
            <p key={i} className="font-semibold">
              <Segments segments={block.segments} />
            </p>
          );
        }
        if (block.kind === "bullet") {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span aria-hidden="true">•</span>
              <span className="min-w-0">
                <Segments segments={block.segments} />
              </span>
            </div>
          );
        }
        return (
          <p key={i}>
            <Segments segments={block.segments} />
          </p>
        );
      })}
    </div>
  );
};
