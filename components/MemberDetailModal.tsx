import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

export type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  flat_no?: string;
  wing?: string;
  status: string;
  phone?: string | null;
  total_members?: number | null;
  referral_code?: string | null;
  created_at?: string;
  building_id?: string | null;
  buildings?: { name: string } | null;
};

type Props = {
  visible: boolean;
  member: Member | null;
  subtitle?: string;
  actionLoading?: boolean;
  codeLoading?: boolean;
  onClose: () => void;
  onPromote: (m: Member) => void;
  onDemote: (m: Member) => void;
  onDelete: (m: Member) => void;
  onEnsureCode: (m: Member) => void;
  onCopyCode: (code: string) => void;
};

const roleColor = (r: string) =>
  r === 'pramukh' ? Colors.primary : r === 'user' ? Colors.success : Colors.textMuted;

function DetailRow({ icon, label, value, isLast }: { icon: string; label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.detailRow, isLast && { borderBottomWidth: 0 }]}>
      <View style={styles.detailRowIcon}>
        <Ionicons name={icon as any} size={16} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function MemberDetailModal({
  visible, member, subtitle,
  actionLoading, codeLoading,
  onClose, onPromote, onDemote, onDelete, onEnsureCode, onCopyCode,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>User Details</Text>
            {subtitle ? <Text style={styles.modalSub}>{subtitle}</Text> : null}
          </View>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {member && (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View style={styles.detailHero}>
              <View style={styles.detailAvatar}>
                <Text style={styles.detailAvatarText}>
                  {member.name?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={styles.detailName}>{member.name}</Text>
              <Text style={styles.detailEmail}>{member.email}</Text>
              <View style={styles.detailBadgeRow}>
                <View style={[styles.roleBadge, { backgroundColor: roleColor(member.role) + '22' }]}>
                  <Text style={[styles.roleText, { color: roleColor(member.role) }]}>
                    {member.role}
                  </Text>
                </View>
                <View style={[
                  styles.roleBadge,
                  { backgroundColor: (member.status === 'approved' ? Colors.success : Colors.warning) + '22' },
                ]}>
                  <Text style={[
                    styles.roleText,
                    { color: member.status === 'approved' ? Colors.success : Colors.warning },
                  ]}>
                    {member.status}
                  </Text>
                </View>
              </View>
            </View>

            {/* Details */}
            <View style={styles.detailCard}>
              <DetailRow icon="call-outline" label="Phone" value={member.phone || '—'} />
              <DetailRow
                icon="home-outline"
                label="Flat / Wing"
                value={
                  member.wing || member.flat_no
                    ? `${member.wing ? 'Wing ' + member.wing : ''}${member.wing && member.flat_no ? ' · ' : ''}${member.flat_no ? 'Flat ' + member.flat_no : ''}`
                    : '—'
                }
              />
              <DetailRow
                icon="business-outline"
                label="Building"
                value={member.buildings?.name || '—'}
              />
              <DetailRow
                icon="people-outline"
                label="Total Family Members"
                value={member.total_members != null ? String(member.total_members) : '—'}
              />
              <DetailRow
                icon="calendar-outline"
                label="Member Since"
                value={
                  member.created_at
                    ? new Date(member.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'
                }
                isLast
              />
            </View>

            {/* Referral */}
            <View style={styles.detailSectionTitle}>
              <Ionicons name="gift-outline" size={16} color="#7C3AED" />
              <Text style={styles.detailSectionTitleText}>Refer & Earn</Text>
            </View>
            <View style={styles.referralCard}>
              <Text style={styles.referralLabel}>Referral Code</Text>
              {member.referral_code ? (
                <>
                  <Text style={styles.referralCode}>{member.referral_code}</Text>
                  <TouchableOpacity
                    style={styles.referralCopyBtn}
                    onPress={() => onCopyCode(member.referral_code as string)}
                  >
                    <Ionicons name="copy-outline" size={16} color={Colors.primary} />
                    <Text style={styles.referralCopyBtnText}>Copy Code</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.referralEmpty}>Not generated yet</Text>
                  <TouchableOpacity
                    style={styles.referralGenerateBtn}
                    onPress={() => onEnsureCode(member)}
                    disabled={codeLoading}
                  >
                    {codeLoading ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <>
                        <Ionicons name="sparkles-outline" size={16} color={Colors.white} />
                        <Text style={styles.referralGenerateBtnText}>Generate Code</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Actions */}
            <View style={styles.detailSectionTitle}>
              <Ionicons name="settings-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.detailSectionTitleText}>Actions</Text>
            </View>

            {member.role === 'user' && (
              <TouchableOpacity
                style={[styles.actionRowBtn, { backgroundColor: '#7C3AED' }]}
                onPress={() => onPromote(member)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="arrow-up-circle" size={20} color={Colors.white} />
                    <Text style={styles.actionRowBtnText}>Promote to Pramukh</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {member.role === 'pramukh' && (
              <TouchableOpacity
                style={[styles.actionRowBtn, { backgroundColor: '#F59E0B' }]}
                onPress={() => onDemote(member)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="arrow-down-circle" size={20} color={Colors.white} />
                    <Text style={styles.actionRowBtnText}>Demote to User</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {member.role !== 'admin' && (
              <TouchableOpacity
                style={[styles.actionRowBtn, { backgroundColor: Colors.danger }]}
                onPress={() => onDelete(member)}
                disabled={actionLoading}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.white} />
                <Text style={styles.actionRowBtnText}>Delete User</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { fontSize: 12, fontWeight: '700' },
  detailHero: { alignItems: 'center', paddingVertical: 16, marginBottom: 8 },
  detailAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  detailAvatarText: { fontSize: 32, fontWeight: '800', color: Colors.primary },
  detailName: { fontSize: 20, fontWeight: '800', color: Colors.text },
  detailEmail: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  detailBadgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  detailCard: { backgroundColor: Colors.bg, borderRadius: 14, paddingHorizontal: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailRowIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  detailRowLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailRowValue: { fontSize: 14, color: Colors.text, fontWeight: '600', marginTop: 2 },
  detailSectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4 },
  detailSectionTitleText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  referralCard: { backgroundColor: '#F5F3FF', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#DDD6FE' },
  referralLabel: { fontSize: 12, color: '#7C3AED', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  referralCode: { fontSize: 28, fontWeight: '900', color: '#5B21B6', letterSpacing: 6, marginBottom: 12 },
  referralEmpty: { fontSize: 14, color: Colors.textMuted, fontStyle: 'italic', marginBottom: 12 },
  referralCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  referralCopyBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  referralGenerateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, minWidth: 160, justifyContent: 'center' },
  referralGenerateBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  actionRowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, marginBottom: 10 },
  actionRowBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
