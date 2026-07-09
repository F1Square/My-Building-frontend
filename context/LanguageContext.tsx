import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, T } from '../constants/translations';
import api from '../utils/api';

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

  const initForUser = useCallback(async (userId: string) => {
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
      let chosen = Boolean(resolvedLang);

      if (!resolvedLang) {
        try {
          const res = await api.get('/auth/me');
          const serverLang = res.data?.user?.app_language;
          if (isValidLang(serverLang)) {
            resolvedLang = serverLang;
            chosen = true;
            await AsyncStorage.setItem(key, serverLang);
          }
        } catch (error) {
          console.warn('Could not load app language from server:', error);
        }
      }

      if (!resolvedLang) {
        const deviceLang = await AsyncStorage.getItem('app_language');
        if (requestId !== initRequestIdRef.current) return;
        if (isValidLang(deviceLang)) {
          resolvedLang = deviceLang;
        } else {
          resolvedLang = 'en';
        }
        chosen = false;
      }

      if (requestId !== initRequestIdRef.current) return;
      setLang(resolvedLang);
      setHasChosen(chosen);
      await syncLanguageToServer(resolvedLang);
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
