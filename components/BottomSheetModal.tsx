import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  Dimensions, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');
export const SHEET_MAX_HEIGHT = SCREEN_H * 0.88;
export const SCROLL_MAX_HEIGHT = SCREEN_H * 0.72;

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
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

export default function BottomSheetModal({ visible, onClose, title, subtitle, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={sheetStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={sheetStyles.backdrop} onPress={onClose} />
        <View style={[sheetStyles.sheet, { maxHeight: SHEET_MAX_HEIGHT, paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.modalHeader}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={sheetStyles.modalTitle}>{title}</Text>
              {subtitle ? <Text style={sheetStyles.modalSub} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={28} color={Colors.border} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={sheetStyles.modalScroll}
            contentContainerStyle={sheetStyles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            nestedScrollEnabled
            bounces
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const sheetStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    width: '100%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  modalScroll: { maxHeight: SCROLL_MAX_HEIGHT },
  modalScrollContent: { paddingBottom: 16 },
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
