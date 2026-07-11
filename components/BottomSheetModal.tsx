import React, { useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

/** Re-export for forms inside the sheet (keyboard-aware). */
export { BottomSheetTextInput };

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Override height — default ['90%', '100%'] for forms; use e.g. ['42%'] for short sheets. */
  snapPoints?: (string | number)[];
  /** @deprecated Kept for callers — Gorhom handles keyboard. */
  avoidKeyboard?: boolean;
};

export function DetailRow({ icon, label, value, isLast }: { icon: string; label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[sheetStyles.detailRow, isLast && { borderBottomWidth: 0 }]}>
      <View style={sheetStyles.detailRowIcon}>
        <Ionicons name={icon as any} size={16} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={sheetStyles.detailRowLabel}>{label}</Text>
        <Text style={sheetStyles.detailRowValue}>{value}</Text>
      </View>
    </View>
  );
}

/**
 * App bottom sheet.
 *
 * RN Modal handles open/close via `visible` (reliable with Expo Router).
 * Gorhom BottomSheet provides keyboard-aware scroll + BottomSheetTextInput.
 */
export default function BottomSheetModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  snapPoints: snapPointsProp,
}: Props) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(
    () => snapPointsProp ?? ['90%', '100%'],
    [snapPointsProp],
  );

  const handleChange = useCallback((index: number) => {
    if (index === -1) onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Gesture root inside Modal — required for Gorhom gestures on Android */}
      <GestureHandlerRootView style={sheetStyles.flex}>
        <View style={sheetStyles.flex}>
          <Pressable style={sheetStyles.backdrop} onPress={onClose} />
          <BottomSheet
            index={0}
            snapPoints={snapPoints}
            enablePanDownToClose
            enableDynamicSizing={false}
            onClose={onClose}
            onChange={handleChange}
            keyboardBehavior="extend"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
            handleIndicatorStyle={sheetStyles.handleIndicator}
            backgroundStyle={sheetStyles.background}
            topInset={insets.top}
          >
            <BottomSheetScrollView
              contentContainerStyle={[
                sheetStyles.modalScrollContent,
                { paddingBottom: Math.max(insets.bottom, 120) },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <View style={sheetStyles.header}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={sheetStyles.modalTitle}>{title}</Text>
                  {subtitle ? (
                    <Text style={sheetStyles.modalSub} numberOfLines={1}>{subtitle}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={28} color={Colors.border} />
                </TouchableOpacity>
              </View>
              {children}
            </BottomSheetScrollView>
          </BottomSheet>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

export const sheetStyles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  background: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailRowLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRowValue: { fontSize: 14, color: Colors.text, fontWeight: '600', marginTop: 2 },
  detailHero: { alignItems: 'center', paddingVertical: 12, marginBottom: 4 },
  detailHeroIcon: { fontSize: 40, marginBottom: 10 },
  detailHeroTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  detailHeroSub: { fontSize: 13, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },
  detailBadgeRow: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'center' },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  detailCard: {
    backgroundColor: Colors.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bodyCard: {
    backgroundColor: Colors.bg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bodyLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  bodyText: { fontSize: 15, color: Colors.text, lineHeight: 24 },
});

export const SHEET_MAX_HEIGHT = 0;
export const SCROLL_MAX_HEIGHT = 0;
