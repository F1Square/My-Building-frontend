import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGES, Language } from '../constants/translations';

// Visual config per language card
const LANG_CONFIG: Record<Language, { bg: string; emoji: string; emojiSize: number }> = {
  en: { bg: '#1E3A8A', emoji: '🗽', emojiSize: 80 },
  gu: { bg: '#C2185B', emoji: '🌸', emojiSize: 80 },
  hi: { bg: '#B45309', emoji: '🕌', emojiSize: 80 },
};

export default function ChooseLanguageScreen() {
  const { setLanguage, language, t } = useLanguage();
  const [selected, setSelected] = useState<Language>(language);

  const handleContinue = async () => {
    await setLanguage(selected);
    // Navigation handled by _layout.tsx watching hasChosen
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.content}>
        <Text style={styles.welcome}>{t('welcomeGreeting')}</Text>
        <Text style={styles.title}>{t('chooseLanguage')}</Text>

        <View style={styles.cards}>
          {LANGUAGES.map((lang) => {
            const cfg = LANG_CONFIG[lang.code];
            const active = selected === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.card, { backgroundColor: cfg.bg }, active && styles.cardActive]}
                onPress={() => setSelected(lang.code)}
                activeOpacity={0.85}
              >
                {/* Emoji watermark */}
                <Text style={[styles.cardEmoji, { fontSize: cfg.emojiSize }]}>{cfg.emoji}</Text>

                {/* Text */}
                <View style={styles.cardText}>
                  <Text style={styles.cardNative}>{lang.nativeLabel}</Text>
                  <Text style={styles.cardLabel}>{lang.label}</Text>
                </View>

                {/* Checkmark */}
                {active && (
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={16} color={cfg.bg} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.9}>
          <Text style={styles.continueBtnText}>{t('continueBtn')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },
  welcome: { fontSize: 18, color: Colors.textMuted, textAlign: 'center', marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 32 },
  cards: { gap: 14 },
  card: {
    borderRadius: 18, height: 110, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24,
    position: 'relative',
  },
  cardActive: { borderWidth: 3, borderColor: Colors.white },
  cardEmoji: {
    position: 'absolute', right: 16, bottom: -8,
    opacity: 0.35,
  },
  cardText: { flex: 1 },
  cardNative: { fontSize: 22, fontWeight: '800', color: Colors.white },
  cardLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  checkCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
  },
  footer: { paddingHorizontal: 24, paddingBottom: 32 },
  continueBtn: {
    backgroundColor: '#7B1F4E',
    borderRadius: 14, paddingVertical: 18,
    alignItems: 'center',
  },
  continueBtnText: { color: Colors.white, fontSize: 17, fontWeight: '800' },
});
