import React from 'react';
import { View, Text } from 'react-native';
import BottomSheetModal, { DetailRow, sheetStyles } from './BottomSheetModal';

export type ParkingReport = {
  id: string;
  description: string;
  vehicle_number?: string | null;
  location?: string | null;
  reported_by?: string | null;
  created_at: string;
  users?: { name: string } | null;
};

type Props = {
  visible: boolean;
  report: ParkingReport | null;
  onClose: () => void;
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

export default function ParkingReportDetailModal({ visible, report, onClose }: Props) {
  if (!report) {
    return (
      <BottomSheetModal visible={visible} onClose={onClose} title="Parking Report">
        <View />
      </BottomSheetModal>
    );
  }

  const reporter = report.users?.name || report.reported_by || '—';

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Parking Report"
      subtitle={report.vehicle_number || formatDate(report.created_at)}
    >
      <View style={sheetStyles.detailHero}>
        <Text style={sheetStyles.detailHeroIcon}>🚨</Text>
        <Text style={sheetStyles.detailHeroTitle}>Mis-parking Report</Text>
        <Text style={sheetStyles.detailHeroSub}>{formatDate(report.created_at)}</Text>
      </View>

      <View style={sheetStyles.bodyCard}>
        <Text style={sheetStyles.bodyLabel}>Description</Text>
        <Text style={sheetStyles.bodyText}>{report.description}</Text>
      </View>

      <View style={sheetStyles.detailCard}>
        <DetailRow
          icon="car-outline"
          label="Vehicle Number"
          value={report.vehicle_number || '—'}
        />
        <DetailRow
          icon="location-outline"
          label="Location"
          value={report.location || '—'}
        />
        <DetailRow
          icon="person-outline"
          label="Reported By"
          value={reporter}
        />
        <DetailRow
          icon="calendar-outline"
          label="Reported On"
          value={formatDate(report.created_at)}
          isLast
        />
      </View>
    </BottomSheetModal>
  );
}
