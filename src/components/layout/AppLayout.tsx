import { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { SafeAreaContainer } from "@/components/layout/SafeAreaContainer";

interface AppLayoutProps {
  children: ReactNode;
  /** Hide bottom nav for auth/onboarding screens */
  hideNav?: boolean;
}

export const AppLayout = ({ children, hideNav = false }: AppLayoutProps) => {
  return (
    <SafeAreaContainer
      safeTop={true}
      safeBottom={hideNav} // Only apply bottom safe-area when nav is hidden
      safeHorizontal={true}
      className="bg-background"
    >
      {/* Main content area */}
      <main
        className="flex-1"
        style={{
          // When nav is visible, reserve space for it (nav height + safe area handled by nav itself)
          paddingBottom: hideNav ? undefined : "4rem",
        }}
      >
        {children}
      </main>
      
      {/* Fixed bottom navigation */}
      {!hideNav && <BottomNav />}
    </SafeAreaContainer>
  );
};
