import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, T } from '../constants/translations';
import api from '../utils/api';

type LanguageContextType = {
  language: Language;
  hasChosen: boolean;
  loading: boolean;
  setLanguage: (lang: Language) => void;
  /** Optional preferredLang skips an extra /auth/me when login/session already has it. */
  initForUser: (userId: string, preferredLang?: string | null) => Promise<void>;
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

function isValidLang(v: string | null | undefined): v is Language {
  return v === 'hi' || v === 'gu' || v === 'en';
}

async function syncLanguageToServer(lang: Language) {
  try {
    await api.post('/auth/language', { app_language: lang });
  } catch (error) {
    console.warn('Failed to sync app language to server:', error);
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>('en');
  const [hasChosen, setHasChosen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const initRequestIdRef = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem('app_language')
      .then((v) => {
        if (isValidLang(v)) setLang(v);
      })
      .catch((error) => {
        console.error('Error reading app language from storage:', error);
      });
  }, []);

  const initForUser = useCallback(async (userId: string, preferredLang?: string | null) => {
    const requestId = ++initRequestIdRef.current;
    setLoading(true);

    try {
      if (userId === '__no_user__') {
        const deviceLang = await AsyncStorage.getItem('app_language');
        if (requestId !== initRequestIdRef.current) return;
        if (isValidLang(deviceLang)) {
          setLang(deviceLang);
          setHasChosen(true);
        } else {
          setHasChosen(false);
        }
        setCurrentUserId(null);
        setLoading(false);
        return;
      }

      setCurrentUserId(userId);
      const key = `app_language_user_${userId}`;
      const localLang = await AsyncStorage.getItem(key);
      if (requestId !== initRequestIdRef.current) return;

      let resolvedLang: Language | null = isValidLang(localLang) ? localLang : null;

      // Login/session payload — avoid a second /auth/me round-trip when possible
      if (!resolvedLang && isValidLang(preferredLang)) {
        resolvedLang = preferredLang;
      }

      if (!resolvedLang) {
        try {
          const res = await api.get('/auth/me');
          const serverLang = res.data?.user?.app_language;
          if (isValidLang(serverLang)) {
            resolvedLang = serverLang;
          }
        } catch (error) {
          console.warn('Could not load app language from server:', error);
        }
      }

      // Device-level choice already means the user picked a language on this phone
      if (!resolvedLang) {
        const deviceLang = await AsyncStorage.getItem('app_language');
        if (requestId !== initRequestIdRef.current) return;
        if (isValidLang(deviceLang)) {
          resolvedLang = deviceLang;
        }
      }

      if (requestId !== initRequestIdRef.current) return;

      if (resolvedLang) {
        setLang(resolvedLang);
        setHasChosen(true);
        await AsyncStorage.setItem(key, resolvedLang);
        await AsyncStorage.setItem('app_language', resolvedLang);
        // Don't block navigation on network sync
        void syncLanguageToServer(resolvedLang);
      } else {
        setLang('en');
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
      await syncLanguageToServer(lang);
    } catch (error) {
      console.error('Error saving language preference:', error);
      setLang(lang);
      setHasChosen(true);
    }
  }, [currentUserId]);

  const t = useCallback((key: string): string => {
    const bundle = T[language] ?? T.en;
    return bundle[key] ?? T.en[key] ?? key;
  }, [language]);

  const contextValue = useMemo(
    () => ({ language, hasChosen, loading, setLanguage, initForUser, t }),
    [language, hasChosen, loading, setLanguage, initForUser, t],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
