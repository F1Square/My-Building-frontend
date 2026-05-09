import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, FlatList, Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import api from '../utils/api';
import type { Building } from '../hooks/useBuildings';
import MemberDetailModal, { type Member } from '../components/MemberDetailModal';
import { useMemberActions } from '../hooks/useMemberActions';

type ModalType = 'none' | 'createBuilding' | 'deleteBuilding' | 'buildingActions' | 'members' | 'memberDetail';

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
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalType>('none');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  // Create form
  const [bForm, setBForm] = useState({
    name: '', address: '',
    has_wings: false, wings: '',
    late_fees_enabled: false, late_fees_amount: '',
    water_reading_enabled: false,
    payment_methods: ['Online', 'Cash', 'Cheque'] as string[],
  });

  // Members modal state
  const [membersBuilding, setMembersBuilding] = useState<Building | null>(null);
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

  useEffect(() => { fetchBuildings(); }, []);

  const fetchBuildings = async () => {
    try {
      const r = await api.get('/buildings');
      setBuildings(r.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const closeModal = () => setModal('none');

  const createBuilding = async () => {
    if (!bForm.name.trim()) return Alert.alert('Error', 'Building name is required');
    setSubmitting(true);
    try {
      await api.post('/buildings/create', {
        name: bForm.name.trim(),
        address: bForm.address.trim(),
        has_wings: bForm.has_wings,
        wings: bForm.has_wings ? bForm.wings.trim() : null,
        late_fees_enabled: bForm.late_fees_enabled,
        late_fees_amount: bForm.late_fees_amount,
        water_reading_enabled: bForm.water_reading_enabled,
        payment_methods: bForm.payment_methods,
      });
      setBForm({
        name: '', address: '',
        has_wings: false, wings: '',
        late_fees_enabled: false, late_fees_amount: '',
        water_reading_enabled: false,
        payment_methods: ['Online', 'Cash', 'Cheque'],
      });
      closeModal();
      fetchBuildings();
      Alert.alert('Done', 'Building created');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  const deleteBuilding = async (b: Building) => {
    Alert.alert(
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
              fetchBuildings();
              closeModal();
              Alert.alert('Success', 'Building and all associated data deleted');
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error || 'Failed to delete');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const openMembers = async (b: Building) => {
    setMembersBuilding(b);
    setModal('members');
    setMembersLoading(true);
    try {
      const r = await api.get(`/buildings/members/${b.id}`);
      setMembers(r.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
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

  const navigateTo = (route: string, b: Building) => {
    router.push({ pathname: route as any, params: { building_id: b.id, building_name: b.name } });
    setSelectedBuilding(null);
  };

  const handleBuildingClick = (b: Building) => {
    setSelectedBuilding(prev => (prev?.id === b.id ? null : b));
  };

  const copyBuildingCode = (buildingId: string, buildingName: string) => {
    const code = getBuildingCode(buildingId);
    Clipboard.setString(code);
    Alert.alert('Copied!', `Building code for "${buildingName}" copied: ${code}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Buildings</Text>
          <Text style={styles.headerSub}>{buildings.length} building{buildings.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModal('buildingActions')}>
          <Ionicons name="business-outline" size={18} color={Colors.white} />
          <Text style={styles.addBtnText}>Manage</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBuildings(); }} />}
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

      {/* Building Management Choices */}
      <Modal visible={modal === 'buildingActions'} transparent animationType="fade">
        <View style={styles.choiceOverlay}>
          <View style={styles.choiceSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Building Management</Text>
              <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
            </View>
            <View style={styles.choiceRow}>
              <TouchableOpacity style={styles.choiceBtn} onPress={() => setModal('createBuilding')}>
                <View style={[styles.choiceIcon, { backgroundColor: Colors.primary + '15' }]}>
                  <Ionicons name="add-circle" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.choiceLabel}>Create New</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.choiceBtn} onPress={() => { setSearchQuery(''); setModal('deleteBuilding'); }}>
                <View style={[styles.choiceIcon, { backgroundColor: Colors.danger + '15' }]}>
                  <Ionicons name="trash" size={32} color={Colors.danger} />
                </View>
                <Text style={styles.choiceLabel}>Delete Existing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Building Selector */}
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
              <TouchableOpacity style={styles.deleteItem} onPress={() => deleteBuilding(item)}>
                <View style={styles.deleteItemInfo}>
                  <Text style={styles.deleteItemName}>{item.name}</Text>
                  <Text style={styles.deleteItemAddress}>{item.address || 'No address'}</Text>
                </View>
                <View style={styles.deleteIconBox}>
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.deleteEmptyState}>
                <Text style={styles.emptyTitle}>No buildings found</Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Create Building */}
      <Modal visible={modal === 'createBuilding'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Building</Text>
            <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Building Name *</Text>
            <TextInput style={styles.input} value={bForm.name} onChangeText={(v) => setBForm({ ...bForm, name: v })} placeholder="e.g. Shree Residency" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={bForm.address} onChangeText={(v) => setBForm({ ...bForm, address: v })} placeholder="e.g. 12, MG Road, Ahmedabad" placeholderTextColor={Colors.textMuted} />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Has Wings?</Text>
                <Text style={styles.switchSub}>Does this society have multiple wings (A, B, C...)?</Text>
              </View>
              <TouchableOpacity
                style={[styles.switch, bForm.has_wings && styles.switchOn]}
                onPress={() => setBForm({ ...bForm, has_wings: !bForm.has_wings })}
              >
                <View style={[styles.switchThumb, bForm.has_wings && styles.switchThumbOn]} />
              </TouchableOpacity>
            </View>

            {bForm.has_wings && (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.label}>Wings (comma separated)</Text>
                <TextInput
                  style={styles.input}
                  value={bForm.wings}
                  onChangeText={(v) => setBForm({ ...bForm, wings: v })}
                  placeholder="e.g. A, B, C"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            )}

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Late Fees</Text>
                <Text style={styles.switchSub}>Enable automatic late fee calculation</Text>
              </View>
              <TouchableOpacity
                style={[styles.switch, bForm.late_fees_enabled && styles.switchOn]}
                onPress={() => setBForm({ ...bForm, late_fees_enabled: !bForm.late_fees_enabled })}
              >
                <View style={[styles.switchThumb, bForm.late_fees_enabled && styles.switchThumbOn]} />
              </TouchableOpacity>
            </View>

            {bForm.late_fees_enabled && (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.label}>Late Fee Amount (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={bForm.late_fees_amount}
                  onChangeText={(v) => setBForm({ ...bForm, late_fees_amount: v })}
                  placeholder="e.g. 100"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            )}

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Water Reading</Text>
                <Text style={styles.switchSub}>Enable separate water bill module</Text>
              </View>
              <TouchableOpacity
                style={[styles.switch, bForm.water_reading_enabled && styles.switchOn]}
                onPress={() => setBForm({ ...bForm, water_reading_enabled: !bForm.water_reading_enabled })}
              >
                <View style={[styles.switchThumb, bForm.water_reading_enabled && styles.switchThumbOn]} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Payment Methods</Text>
            <View style={styles.checkboxGroup}>
              {['Online', 'Cash', 'Cheque'].map(m => {
                const isSelected = bForm.payment_methods.includes(m);
                return (
                  <TouchableOpacity
                    key={m}
                    style={styles.checkboxRow}
                    onPress={() => {
                      const newMethods = isSelected
                        ? bForm.payment_methods.filter(x => x !== m)
                        : [...bForm.payment_methods, m];
                      setBForm({ ...bForm, payment_methods: newMethods });
                    }}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
                    </View>
                    <Text style={styles.checkboxText}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={createBuilding} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Building</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Members */}
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
  moduleButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moduleBtn: { flex: 1, minWidth: '47%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  moduleBtnText: { fontSize: 13, fontWeight: '700' },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, borderWidth: 1.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },

  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 24, marginBottom: 30 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, backgroundColor: Colors.bg, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  switchLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  switchSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  switch: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E5E7EB', padding: 2 },
  switchOn: { backgroundColor: Colors.primary },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.white },
  switchThumbOn: { alignSelf: 'flex-end' },

  checkboxGroup: { flexDirection: 'row', gap: 16, marginTop: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxText: { fontSize: 14, color: Colors.text, fontWeight: '600' },

  // Member rows
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg, borderRadius: 12, padding: 14, marginBottom: 10 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  memberName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  memberEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  memberFlat: { fontSize: 12, color: Colors.primary, marginTop: 2, fontWeight: '600' },
  roleBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 15 },

  // Choice sheet
  choiceOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  choiceSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  choiceRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  choiceBtn: { flex: 1, backgroundColor: Colors.bg, borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  choiceIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  choiceLabel: { fontSize: 15, fontWeight: '800', color: Colors.text },

  // Delete list
  deleteItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bg, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  deleteItemInfo: { flex: 1 },
  deleteItemName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  deleteItemAddress: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  deleteIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.danger + '10', justifyContent: 'center', alignItems: 'center' },
  deleteEmptyState: { alignItems: 'center', marginTop: 40 },
});
