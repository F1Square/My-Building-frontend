import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { CAT_COLORS, CAT_ICONS } from '../constants/societyRules';
import BottomSheetModal, { DetailRow, sheetStyles } from './BottomSheetModal';

export type SocietyRuleDetail = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
  updater?: { name?: string | null } | null;
};

type Props = {
  visible: boolean;
  rule: SocietyRuleDetail | null;
  onClose: () => void;
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SocietyRuleDetailModal({ visible, rule, onClose }: Props) {
  if (!rule) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title="Society Rule" snapPoints={['40%']}>
        <View />
      </BottomSheetModal>
    );
  }

  const color = CAT_COLORS[rule.category] || CAT_COLORS.General;
  const icon = CAT_ICONS[rule.category] || CAT_ICONS.General;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Society Rule"
      subtitle={rule.category}
      snapPoints={['58%', '85%']}
    >
      <View style={sheetStyles.detailHero}>
        <View style={[local.iconWrap, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon as any} size={28} color={color} />
        </View>
        <Text style={sheetStyles.detailHeroTitle}>{rule.title}</Text>
        <Text style={sheetStyles.detailHeroSub}>{rule.category}</Text>
      </View>

      {rule.description ? (
        <View style={sheetStyles.bodyCard}>
          <Text style={sheetStyles.bodyLabel}>Description</Text>
          <Text style={sheetStyles.bodyText}>{rule.description}</Text>
        </View>
      ) : null}

      <View style={sheetStyles.detailCard}>
        <DetailRow icon="grid-outline" label="Category" value={rule.category || 'General'} />
        <DetailRow
          icon="person-outline"
          label="Updated By"
          value={rule.updater?.name || '—'}
        />
        <DetailRow
          icon="calendar-outline"
          label="Last Updated"
          value={formatDate(rule.updated_at || rule.created_at)}
          isLast
        />
      </View>
    </BottomSheetModal>
  );
}

const local = StyleSheet.create({
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
});
