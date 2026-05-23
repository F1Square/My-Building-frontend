import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '../constants/colors';
import BottomSheetModal, { DetailRow, sheetStyles } from './BottomSheetModal';

export type Announcement = {
  id: string;
  title: string;
  body: string;
  priority?: string;
  created_at: string;
  users?: { name: string } | null;
  buildings?: { name: string } | null;
};

type Props = {
  visible: boolean;
  announcement: Announcement | null;
  onClose: () => void;
  showBuilding?: boolean;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AnnouncementDetailModal({ visible, announcement, onClose, showBuilding }: Props) {
  if (!announcement) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title="Announcement">
        <View />
      </BottomSheetModal>
    );
  }

  const isUrgent = announcement.priority === 'urgent';
  const author = announcement.users?.name || '—';

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Announcement"
      subtitle={announcement.title}
    >
      <View style={sheetStyles.detailHero}>
        <Text style={sheetStyles.detailHeroIcon}>{isUrgent ? '🚨' : '📢'}</Text>
        <Text style={sheetStyles.detailHeroTitle}>{announcement.title}</Text>
        <Text style={sheetStyles.detailHeroSub}>By {author}</Text>
        <View style={sheetStyles.detailBadgeRow}>
          <View style={[sheetStyles.badge, { backgroundColor: (isUrgent ? Colors.danger : Colors.primary) + '22' }]}>
            <Text style={[sheetStyles.badgeText, { color: isUrgent ? Colors.danger : Colors.primary }]}>
              {isUrgent ? 'URGENT' : 'NORMAL'}
            </Text>
          </View>
        </View>
      </View>

      <View style={sheetStyles.bodyCard}>
        <Text style={sheetStyles.bodyLabel}>Message</Text>
        <Text style={sheetStyles.bodyText}>{announcement.body}</Text>
      </View>

      <View style={sheetStyles.detailCard}>
        <DetailRow icon="person-outline" label="Posted By" value={author} />
        {showBuilding && announcement.buildings?.name ? (
          <DetailRow icon="business-outline" label="Building" value={announcement.buildings.name} />
        ) : null}
        <DetailRow
          icon="flag-outline"
          label="Priority"
          value={isUrgent ? 'Urgent' : 'Normal'}
        />
        <DetailRow
          icon="calendar-outline"
          label="Posted On"
          value={formatDate(announcement.created_at)}
          isLast
        />
      </View>
    </BottomSheetModal>
  );
}
