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
        className="pb-20"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {children}
      </main>
      
      {/* Fixed bottom navigation */}
      {!hideNav && <BottomNav />}
    </div>
  );
};
