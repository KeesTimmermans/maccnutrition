import { Skeleton } from "@/components/ui/skeleton";

interface MacroRingSkeletonProps {
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: 80,
  md: 100,
  lg: 140,
};

export const MacroRingSkeleton = ({ size = "md" }: MacroRingSkeletonProps) => {
  const px = sizeMap[size];
  return (
    <div className="flex flex-col items-center gap-1">
      <Skeleton className="rounded-full" style={{ width: px, height: px }} />
      <Skeleton className="h-4 w-12 rounded" />
    </div>
  );
};

export const MacroRingGroupSkeleton = () => (
  <div className="flex justify-around items-center">
    <MacroRingSkeleton size="lg" />
    <div className="space-y-4">
      <MacroRingSkeleton size="sm" />
      <MacroRingSkeleton size="sm" />
      <MacroRingSkeleton size="sm" />
      <MacroRingSkeleton size="sm" />
    </div>
  </div>
);
