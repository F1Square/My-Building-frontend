import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, T } from '../constants/translations';

type LanguageContextType = {
  language: Language;
  hasChosen: boolean;
  loading: boolean;
  setLanguage: (lang: Language) => void;
  initForUser: (userId: string) => Promise<void>;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  hasChosen: false,
  loading: true,
  setLanguage: () => { },
  initForUser: async () => { },
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>('en');
  const [hasChosen, setHasChosen] = useState(false);
  // Start as true — stays true until we've fully resolved the language state
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const initRequestIdRef = useRef(0);

  // On app start — load device-level language only
  // hasChosen stays false until initForUser is called
  useEffect(() => {
    AsyncStorage.getItem('app_language')
      .then((v) => {
        if (v === 'hi' || v === 'gu' || v === 'en') setLang(v);
        // Don't set loading=false here — wait for initForUser or no-user path
      })
      .catch((error) => {
        console.error('Error reading app language from storage:', error);
      });
  }, []);

  // Called from _layout when user becomes available (login or restore from storage)
  // Keeps loading=true until done so the router never sees a stale hasChosen=false
  const initForUser = useCallback(async (userId: string) => {
    const requestId = ++initRequestIdRef.current;
    setLoading(true);

    try {
      // Special case: no user logged in (logout state)
      if (userId === '__no_user__') {
        // Check if device-level language exists
        const deviceLang = await AsyncStorage.getItem('app_language');
        if (requestId !== initRequestIdRef.current) return;
        if (deviceLang === 'hi' || deviceLang === 'gu' || deviceLang === 'en') {
          setLang(deviceLang);
          // Device language exists, so user has chosen before
          setHasChosen(true);
        } else {
          setHasChosen(false);
        }
        setLoading(false);
        return;
      }

      setCurrentUserId(userId);
      const key = `app_language_user_${userId}`;
      const v = await AsyncStorage.getItem(key);
      if (requestId !== initRequestIdRef.current) return;

      if (v === 'hi' || v === 'gu' || v === 'en') {
        // User has already picked a language before — skip picker
        setLang(v);
        setHasChosen(true);
      } else {
        // Fresh user — they must go through the language picker.
        // Pre-load the device-level language so the picker has a sensible
        // default highlighted, but do NOT mark hasChosen = true.
        const deviceLang = await AsyncStorage.getItem('app_language');
        if (requestId !== initRequestIdRef.current) return;
        if (deviceLang === 'hi' || deviceLang === 'gu' || deviceLang === 'en') {
          setLang(deviceLang);
        }
        setHasChosen(false);
      }
    } catch (error) {
      console.error('Error initializing language state:', error);
      setHasChosen(false);
    } finally {
      if (requestId === initRequestIdRef.current) setLoading(false);
    }
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      setLang(lang);
      setHasChosen(true);
      await AsyncStorage.setItem('app_language', lang);
      if (currentUserId) {
        await AsyncStorage.setItem(`app_language_user_${currentUserId}`, lang);
      }
    } catch (error) {
      console.error('Error saving language preference:', error);
      // Still update state even if storage fails
      setLang(lang);
      setHasChosen(true);
    }
  }, [currentUserId]);

  const t = useCallback((key: string): string => {
    const bundle = T[language] ?? T.en;
    return bundle[key] ?? T.en[key] ?? key;
  }, [language]);
  const contextValue = useMemo(() => ({ language, hasChosen, loading, setLanguage, initForUser, t }), [language, hasChosen, loading, setLanguage, initForUser, t]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
