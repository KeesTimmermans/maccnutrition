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

        {/* Global legal footer — shown above bottom nav */}
        <footer className="text-center py-4 text-xs text-muted-foreground/60 space-x-3">
          <a
            href="#/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground hover:underline transition-colors"
          >
            Privacy Policy
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="#/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground hover:underline transition-colors"
          >
            Terms &amp; Conditions
          </a>
        </footer>
      </main>

      {/* Fixed bottom navigation */}
      {!hideNav && <BottomNav />}
    </SafeAreaContainer>
  );
};

