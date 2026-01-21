import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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
  const isLoadedRef = useRef(false);

  // Load language from database on mount
  useEffect(() => {
    let mounted = true;

    const loadLanguage = async () => {
      try {
        // Add timeout to prevent hanging on session restoration
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
        // Don't log timeout errors as they're expected fallback behavior
        if (error instanceof Error && !error.message.includes("timeout")) {
          console.error("Error loading language preference:", error);
        }
      } finally {
        if (mounted) {
          isLoadedRef.current = true;
        }
      }
    };

    loadLanguage();

    // Listen for auth changes to reload language
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session?.user) {
        try {
          const { data } = await Promise.race([
            supabase.from("user_baselines").select("preferred_language").eq("user_id", session.user.id).maybeSingle(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 5000)),
          ]);

          if (mounted && data?.preferred_language) {
            setLanguageState(data.preferred_language as Language);
          }
        } catch (error) {
          console.error("Error loading language on sign in:", error);
        }
      } else if (event === "SIGNED_OUT") {
        setLanguageState("en");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("user_baselines").update({ preferred_language: lang }).eq("user_id", user.id);
      }
    } catch (error) {
      console.error("Error saving language preference:", error);
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[language]?.[key] || translations["en"]?.[key] || key;
    },
    [language],
  );

  // Don't block rendering - render children immediately with default language
  // Language will update seamlessly once loaded from the database
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
