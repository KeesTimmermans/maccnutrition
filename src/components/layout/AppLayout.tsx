import { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";

interface AppLayoutProps {
  children: ReactNode;
  /** Hide bottom nav for auth/onboarding screens */
  hideNav?: boolean;
}

export const AppLayout = ({ children, hideNav = false }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Main content area with safe-area padding */}
      <main
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          // Nav height (h-16 = 4rem) + extra buffer (1rem) + safe area
          paddingBottom: hideNav ? "env(safe-area-inset-bottom)" : "calc(5rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>
      
      {/* Fixed bottom navigation */}
      {!hideNav && <BottomNav />}
    </div>
  );
};
