import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import { copyToClipboard } from '../utils/clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import api from '../utils/api';
import { Alert } from '../utils/alert';
import type { Building } from '../hooks/useBuildings';
import MemberDetailModal, { type Member } from '../components/MemberDetailModal';
import { useMemberActions } from '../hooks/useMemberActions';
import { ModuleHeader, ModuleHeaderTextButton } from '../components/ModuleHeader';

type ModalType = 'none' | 'deleteBuilding' | 'buildingActions' | 'updateSelect' | 'members' | 'memberDetail';

type BuildingRow = Building & {
  address?: string;
};

const getBuildingCode = (buildingId: string) =>
  String(buildingId || '').split('-')[0]?.toUpperCase() || '';

const roleColor = (r: string) =>
  r === 'pramukh' ? Colors.primary : r === 'user' ? Colors.success : Colors.textMuted;

const BUILD_ACTIONS = [
  { route: '/maintenance', icon: 'wallet', color: '#10B981', label: 'Maintenance' },
  { route: '/announcements', icon: 'megaphone', color: '#F59E0B', label: 'Notices' },
  { route: '/visitors', icon: 'people', color: '#6366F1', label: 'Visitors' },
  { route: '/parking', icon: 'car', color: '#0EA5E9', label: 'Parking' },
];

export default function BuildingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalType>('none');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingRow | null>(null);

  const [membersBuilding, setMembersBuilding] = useState<BuildingRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const memberActions = useMemberActions({
    onChange: (id, patch) => {
      setMembers(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
      setSelectedMember(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    },
    onDeleted: (id) => {
      setMembers(prev => prev.filter(m => m.id !== id));
      setSelectedMember(null);
      setModal('members');
    },
  });

  const filtered = buildings.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getBuildingCode(b.id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchBuildings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await api.get('/buildings');
      setBuildings(r.data);
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed to load', 4000);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBuildings(buildings.length > 0);
    }, [fetchBuildings, buildings.length])
  );

  const closeModal = () => setModal('none');

  const goToCreate = () => {
    closeModal();
    router.push('/building-form');
  };

  const goToEdit = (buildingId: string) => {
    closeModal();
    router.push({ pathname: '/building-form', params: { building_id: buildingId } });
  };

  const deleteBuilding = async (b: BuildingRow) => {
    Alert.confirm(
      'Delete Everything?',
      `Are you sure you want to delete "${b.name}"?\n\nThis will permanently delete:\n• All Residents & Roles\n• All Notices & Announcements\n• All Maintenance Bills & Payments\n• All Expenses & Funds\n• All Parking & Visitor Logs\n\nThis action CANNOT be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE PERMANENTLY',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.delete(`/buildings/${b.id}`);
              fetchBuildings(true);
              closeModal();
              Alert.success('Success', 'Building and all associated data deleted', 4000);
            } catch (e: any) {
              Alert.error('Error', e.response?.data?.error || 'Failed to delete', 4000);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const openMembers = async (b: BuildingRow) => {
    setMembersBuilding(b);
    setModal('members');
    setMembersLoading(true);
    try {
      const r = await api.get(`/buildings/members/${b.id}`);
      setMembers(r.data);
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed', 4000);
    } finally {
      setMembersLoading(false);
    }
  };

  const openMemberDetail = (m: Member) => {
    setSelectedMember(m);
    setModal('memberDetail');
  };

  const closeMemberDetail = () => {
    setSelectedMember(null);
    setModal('members');
  };

  const navigateTo = (route: string, b: BuildingRow) => {
    router.push({ pathname: route as any, params: { building_id: b.id, building_name: b.name } });
    setSelectedBuilding(null);
  };

  const handleBuildingClick = (b: BuildingRow) => {
    setSelectedBuilding(prev => (prev?.id === b.id ? null : b));
  };

  const copyBuildingCode = async (buildingId: string, buildingName: string) => {
    const code = getBuildingCode(buildingId);
    if (await copyToClipboard(code)) {
      Alert.success('Copied!', `Building code for "${buildingName}" copied: ${code}`, 4000);
    }
  };

  return (
    <View style={styles.container}>
      <ModuleHeader
        title="Buildings"
        subtitle={`${buildings.length} building${buildings.length !== 1 ? 's' : ''}`}
        rightAction={
          <ModuleHeaderTextButton
            icon="business-outline"
            label="Manage"
            onPress={() => setModal('buildingActions')}
          />
        }
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBuildings(true); }} />}
        >
          {buildings.length > 0 && (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search buildings..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={Colors.textMuted}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{searchQuery ? '🔍' : '🏢'}</Text>
              <Text style={styles.emptyTitle}>{searchQuery ? 'No buildings found' : 'No buildings yet'}</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Try a different search term' : 'Tap Manage above to create your first building'}
              </Text>
            </View>
          ) : (
            filtered.map((b) => (
              <View key={b.id} style={styles.buildingCard}>
                <TouchableOpacity
                  style={styles.buildingNameRow}
                  onPress={() => handleBuildingClick(b)}
                  activeOpacity={0.7}
                >
                  <View style={styles.buildingIconBox}><Text style={{ fontSize: 22 }}>🏢</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.buildingName}>{b.name}</Text>
                    {selectedBuilding?.id === b.id && (
                      <View style={styles.buildingIdRow}>
                        <Text style={styles.buildingId}>Code: {getBuildingCode(b.id)}</Text>
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            copyBuildingCode(b.id, b.name);
                          }}
                        >
                          <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <Ionicons
                    name={selectedBuilding?.id === b.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>

                {selectedBuilding?.id === b.id && (
                  <View style={styles.buildingExpandedSection}>
                    {b.address && (
                      <View style={styles.buildingInfoRow}>
                        <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                        <Text style={styles.buildingInfoText}>{b.address}</Text>
                      </View>
                    )}

                    <View style={styles.buildingActionsExpanded}>
                      <TouchableOpacity style={styles.membersBtn} onPress={() => openMembers(b)}>
                        <Ionicons name="people" size={14} color={Colors.primary} />
                        <Text style={styles.membersBtnText}>{t('members')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.editBtn} onPress={() => goToEdit(b.id)}>
                        <Ionicons name="create-outline" size={14} color={Colors.warning} />
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.moduleButtons}>
                      {BUILD_ACTIONS.map((item) => (
                        <TouchableOpacity
                          key={item.route}
                          style={[styles.moduleBtn, { backgroundColor: item.color + '15', borderColor: item.color + '30' }]}
                          onPress={() => navigateTo(item.route, b)}
                        >
                          <Ionicons name={item.icon as any} size={18} color={item.color} />
                          <Text style={[styles.moduleBtnText, { color: item.color }]}>{item.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={modal === 'buildingActions'} transparent animationType="fade">
        <View style={styles.choiceOverlay}>
          <View style={styles.choiceSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Building Management</Text>
              <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
            </View>
            <View style={styles.choiceGrid}>
              <TouchableOpacity style={styles.choiceBtn} onPress={goToCreate}>
                <View style={[styles.choiceIcon, { backgroundColor: Colors.primary + '15' }]}>
                  <Ionicons name="add-circle" size={28} color={Colors.primary} />
                </View>
                <Text style={styles.choiceLabel}>Create New</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.choiceBtn} onPress={() => { setSearchQuery(''); setModal('updateSelect'); }}>
                <View style={[styles.choiceIcon, { backgroundColor: Colors.warning + '15' }]}>
                  <Ionicons name="create" size={28} color={Colors.warning} />
                </View>
                <Text style={styles.choiceLabel}>Update Existing</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.choiceBtn} onPress={() => { setSearchQuery(''); setModal('deleteBuilding'); }}>
                <View style={[styles.choiceIcon, { backgroundColor: Colors.danger + '15' }]}>
                  <Ionicons name="trash" size={28} color={Colors.danger} />
                </View>
                <Text style={styles.choiceLabel}>Delete Existing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modal === 'updateSelect'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Update Building</Text>
              <Text style={styles.modalSub}>Select a building to edit</Text>
            </View>
            <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <View style={[styles.searchBar, { margin: 16 }]}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search building..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.listItem} onPress={() => goToEdit(item.id)}>
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName}>{item.name}</Text>
                  <Text style={styles.listItemAddress}>{item.address || 'No address'}</Text>
                </View>
                <View style={[styles.listItemIcon, { backgroundColor: Colors.warning + '10' }]}>
                  <Ionicons name="create-outline" size={20} color={Colors.warning} />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyTitle}>No buildings found</Text>
              </View>
            }
          />
        </View>
      </Modal>

      <Modal visible={modal === 'deleteBuilding'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Delete Building</Text>
              <Text style={styles.modalSub}>Select a building to remove</Text>
            </View>
            <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <View style={[styles.searchBar, { margin: 16 }]}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search building to delete..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.listItem} onPress={() => deleteBuilding(item)} disabled={submitting}>
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName}>{item.name}</Text>
                  <Text style={styles.listItemAddress}>{item.address || 'No address'}</Text>
                </View>
                <View style={[styles.listItemIcon, { backgroundColor: Colors.danger + '10' }]}>
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyTitle}>No buildings found</Text>
              </View>
            }
          />
        </View>
      </Modal>

      <Modal visible={modal === 'members'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{membersBuilding?.name}</Text>
              <Text style={styles.modalSub}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity onPress={() => { setModal('none'); setMembersBuilding(null); setMembers([]); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          {membersLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
          ) : (
            <FlatList
              data={members}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={styles.empty}>No members yet</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.memberCard}
                  onPress={() => openMemberDetail(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{item.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{item.name}</Text>
                    <Text style={styles.memberEmail}>{item.email}</Text>
                    {(item.flat_no || item.wing) && (
                      <Text style={styles.memberFlat}>
                        {item.wing ? `Wing ${item.wing} · ` : ''}{item.flat_no ? `Flat ${item.flat_no}` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.roleBadge, { backgroundColor: roleColor(item.role) + '20' }]}>
                      <Text style={[styles.roleText, { color: roleColor(item.role) }]}>{item.role}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      <MemberDetailModal
        visible={modal === 'memberDetail'}
        member={selectedMember}
        subtitle={membersBuilding?.name}
        actionLoading={memberActions.actionLoading}
        codeLoading={memberActions.codeLoading}
        onClose={closeMemberDetail}
        onPromote={memberActions.promote}
        onDemote={memberActions.demote}
        onDelete={memberActions.remove}
        onEnsureCode={memberActions.ensureCode}
        onCopyCode={memberActions.copyCode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },

  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  buildingCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  buildingNameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  buildingIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  buildingName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  buildingIdRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  buildingId: { fontSize: 11, color: Colors.primary, fontFamily: 'monospace', fontWeight: '600' },
  copyBtn: { backgroundColor: Colors.primary + '15', borderRadius: 6, padding: 4 },
  buildingExpandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  buildingInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  buildingInfoText: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  buildingActionsExpanded: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  membersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  membersBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warning + '12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  editBtnText: { fontSize: 12, color: Colors.warning, fontWeight: '700' },
  moduleButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moduleBtn: { flex: 1, minWidth: '47%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  moduleBtnText: { fontSize: 13, fontWeight: '700' },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, borderWidth: 1.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },

  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg, borderRadius: 12, padding: 14, marginBottom: 10 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  memberName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  memberEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  memberFlat: { fontSize: 12, color: Colors.primary, marginTop: 2, fontWeight: '600' },
  roleBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 15 },

  choiceOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  choiceSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  choiceBtn: { width: '31%', flexGrow: 1, minWidth: 100, backgroundColor: Colors.bg, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  choiceIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  choiceLabel: { fontSize: 13, fontWeight: '800', color: Colors.text, textAlign: 'center' },

  listItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bg, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  listItemInfo: { flex: 1 },
  listItemName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  listItemAddress: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  listItemIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  emptyList: { alignItems: 'center', marginTop: 40 },
});
