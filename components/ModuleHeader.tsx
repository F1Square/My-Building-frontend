import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';

export interface ModuleHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#3B5FC0',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'left',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'left',
  },
  right: {
    flexShrink: 0,
    minWidth: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rightSpacer: {
    width: 36,
    height: 36,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textBtnLabel: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});

export const moduleHeaderStyles = styles;

export function ModuleHeader({ title, subtitle, onBack, rightAction, style }: ModuleHeaderProps) {
  const router = useRouter();

  return (
    <View style={[styles.header, style]}>
      <TouchableOpacity
        onPress={onBack ?? (() => router.back())}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={22} color={Colors.white} />
      </TouchableOpacity>
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>
        {rightAction ?? <View style={styles.rightSpacer} />}
      </View>
    </View>
  );
}

export function ModuleHeaderIconButton({
  icon,
  onPress,
  size = 22,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  size?: number;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.iconBtn} accessibilityRole="button">
      <Ionicons name={icon} size={size} color={Colors.white} />
    </TouchableOpacity>
  );
}

export function ModuleHeaderTextButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.textBtn} accessibilityRole="button">
      {icon ? <Ionicons name={icon} size={18} color={Colors.white} /> : null}
      <Text style={styles.textBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}
