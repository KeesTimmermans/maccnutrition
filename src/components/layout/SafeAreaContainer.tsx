import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SafeAreaContainerProps {
  children: ReactNode;
  /** Additional classes for the container */
  className?: string;
  /** Whether this is a full-screen overlay (uses fixed positioning + z-index) */
  overlay?: boolean;
  /** Whether to apply top safe-area padding */
  safeTop?: boolean;
  /** Whether to apply bottom safe-area padding */
  safeBottom?: boolean;
  /** Whether to apply left/right safe-area padding */
  safeHorizontal?: boolean;
}

/**
 * SafeAreaContainer provides consistent safe-area handling for all screens.
 * 
 * Usage:
 * - For full-screen overlays: <SafeAreaContainer overlay>...</SafeAreaContainer>
 * - For page content: <SafeAreaContainer>...</SafeAreaContainer>
 * 
 * All fixed/sticky headers and footers within should NOT implement their own
 * safe-area insets - this container handles it consistently.
 */
export const SafeAreaContainer = ({
  children,
  className,
  overlay = false,
  safeTop = true,
  safeBottom = true,
  safeHorizontal = true,
}: SafeAreaContainerProps) => {
  const baseStyles = overlay
    ? "fixed inset-0 z-[60] flex flex-col bg-background"
    : "min-h-dvh flex flex-col";

  return (
    <div
      className={cn(baseStyles, className)}
      style={{
        paddingTop: safeTop ? "env(safe-area-inset-top)" : undefined,
        paddingBottom: safeBottom ? "env(safe-area-inset-bottom)" : undefined,
        paddingLeft: safeHorizontal ? "env(safe-area-inset-left)" : undefined,
        paddingRight: safeHorizontal ? "env(safe-area-inset-right)" : undefined,
      }}
    >
      {children}
    </div>
  );
};
