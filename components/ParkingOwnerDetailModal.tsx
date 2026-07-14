import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import BottomSheetModal, { DetailRow, sheetStyles } from './BottomSheetModal';

export type ParkingOwner = {
  id?: string;
  name?: string | null;
  wing?: string | null;
  flat_no?: string | null;
};

type Props = {
  visible: boolean;
  owner: ParkingOwner | null;
  onClose: () => void;
};

export default function ParkingOwnerDetailModal({ visible, owner, onClose }: Props) {
  if (!owner) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title="Resident Details" snapPoints={['38%']}>
        <View />
      </BottomSheetModal>
    );
  }

  const name = owner.name?.trim() || '—';
  const wing = owner.wing ? String(owner.wing) : '—';
  const flat = owner.flat_no ? String(owner.flat_no) : '—';

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Resident Details"
      subtitle={name !== '—' ? name : undefined}
      snapPoints={['42%']}
    >
      <View style={sheetStyles.detailHero}>
        <View style={local.avatar}>
          <Ionicons name="person" size={28} color={Colors.primary} />
        </View>
        <Text style={sheetStyles.detailHeroTitle}>{name}</Text>
        <Text style={sheetStyles.detailHeroSub}>Vehicle owner</Text>
      </View>

      <View style={sheetStyles.detailCard}>
        <DetailRow icon="person-outline" label="Name" value={name} />
        <DetailRow icon="grid-outline" label="Wing" value={wing} />
        <DetailRow icon="home-outline" label="Flat No" value={flat} isLast />
      </View>
    </BottomSheetModal>
  );
}

const local = StyleSheet.create({
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
});
