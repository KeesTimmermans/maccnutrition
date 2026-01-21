import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { translations, SupportedLanguage, TranslationKey } from "./translations";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // Start with browser language or 'en' - don't block on auth
  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    const browserLang = navigator.language.split("-")[0];
    return (browserLang in translations ? browserLang : "en") as SupportedLanguage;
  });

  useEffect(() => {
    // Load user's preferred language asynchronously - don't block render
    const loadUserLanguage = async () => {
      try {
        // Use getSession instead of getUser - it's faster and doesn't make a network request
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user?.user_metadata?.preferred_language) {
          const userLang = session.user.user_metadata.preferred_language as SupportedLanguage;
          if (userLang in translations) {
            setLanguage(userLang);
          }
        }
      } catch (error) {
        console.error("Failed to load user language preference:", error);
        // Already have a default language, so this is fine
      }
    };

    loadUserLanguage();

    // Also listen for auth changes to update language
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.user_metadata?.preferred_language) {
        const userLang = session.user.user_metadata.preferred_language as SupportedLanguage;
        if (userLang in translations) {
          setLanguage(userLang);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  const contextValue: LanguageContextType = {
    language,
    setLanguage,
    t,
  };

  // NEVER return null - always render children
  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
