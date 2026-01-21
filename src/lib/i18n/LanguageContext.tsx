import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Language, translations, languageNames } from "./translations";
import { supabase } from "@/integrations/supabase/client";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
  languageNames: Record<Language, string>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>("en");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load language from database on mount
  useEffect(() => {
    let mounted = true;

    const loadLanguage = async () => {
      try {
        // Add timeout to prevent hanging
        const {
          data: { user },
        } = await Promise.race([
          supabase.auth.getUser(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Auth timeout")), 5000)),
        ]);

        if (!mounted) return;

        if (user) {
          const { data } = await Promise.race([
            supabase.from("user_baselines").select("preferred_language").eq("user_id", user.id).maybeSingle(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 5000)),
          ]);

          if (mounted && data?.preferred_language) {
            setLanguageState(data.preferred_language as Language);
          }
        }
      } catch (error) {
        console.error("Error loading language preference:", error);
      } finally {
        if (mounted) setIsLoaded(true);
      }
    };

    loadLanguage();

    // Failsafe: always mark as loaded after 5 seconds
    const timeout = setTimeout(() => {
      if (mounted && !isLoaded) {
        console.warn("Language loading timed out, using default");
        setIsLoaded(true);
      }
    }, 5000);

    // ... rest of auth listener stays the same ...

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  // Don't block rendering - show children with default language
  // Language will update seamlessly when loaded
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languageNames }}>{children}</LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
