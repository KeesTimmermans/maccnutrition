import { Trophy } from "lucide-react";
import type { TargetSource } from "@/hooks/useActiveNutritionTargets";

interface ActiveTargetSourceBadgeProps {
  source: TargetSource;
  className?: string;
}

/**
 * Small inline badge that tells the user where their current
 * nutrition targets come from. Only renders when Competition Prep
 * is actively overriding the standard plan.
 */
export const ActiveTargetSourceBadge = ({ source, className = "" }: ActiveTargetSourceBadgeProps) => {
  if (source !== "competition_prep") return null;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full ${className}`}>
      <Trophy className="w-3 h-3" />
      Targets driven by Competition Prep
    </span>
  );
};
