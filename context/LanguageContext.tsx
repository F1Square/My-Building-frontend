import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, T, LANGUAGES } from '../constants/translations';

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
  setLanguage: () => {},
  initForUser: async () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>('en');
  const [hasChosen, setHasChosen] = useState(false);
  // Start as true — stays true until we've fully resolved the language state
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // On app start — load device-level language only
  // hasChosen stays false until initForUser is called
  useEffect(() => {
    AsyncStorage.getItem('app_language').then((v) => {
      if (v === 'hi' || v === 'gu' || v === 'en') setLang(v);
      // Don't set loading=false here — wait for initForUser or no-user path
    });
  }, []);

  // Called from _layout when user becomes available (login or restore from storage)
  // Keeps loading=true until done so the router never sees a stale hasChosen=false
  const initForUser = async (userId: string) => {
    // Special case: no user logged in (logout state)
    if (userId === '__no_user__') {
      // Check if device-level language exists
      const deviceLang = await AsyncStorage.getItem('app_language');
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
    
    if (v === 'hi' || v === 'gu' || v === 'en') {
      // User-specific language found
      setLang(v);
      setHasChosen(true);
    } else {
      // No user-specific language — check device-level language as fallback
      const deviceLang = await AsyncStorage.getItem('app_language');
      if (deviceLang === 'hi' || deviceLang === 'gu' || deviceLang === 'en') {
        setLang(deviceLang);
        // If device language exists, mark as chosen and save to user-specific key
        setHasChosen(true);
        await AsyncStorage.setItem(key, deviceLang);
      } else {
        // Truly new user — no language preference found anywhere
        setHasChosen(false);
      }
    }
    setLoading(false);
  };

  // Called when no user is logged in — unblock the router
  const markNoUser = () => {
    setHasChosen(false);
    setLoading(false);
  };

  const setLanguage = async (lang: Language) => {
    setLang(lang);
    setHasChosen(true);
    await AsyncStorage.setItem('app_language', lang);
    if (currentUserId) {
      await AsyncStorage.setItem(`app_language_user_${currentUserId}`, lang);
    }
  };

  const t = (key: string): string => T[language][key] ?? T['en'][key] ?? key;

  return (
    <LanguageContext.Provider value={{ language, hasChosen, loading, setLanguage, initForUser, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
