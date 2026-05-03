import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, FlatList, Clipboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../utils/api';
import BuildingDropdown from '../components/BuildingDropdown';
import type { Building } from '../hooks/useBuildings';

type ModalType = 'none' | 'createBuilding' | 'createPramukh' | 'members' | 'subscriptions' | 'grantSub' | 'buildingSelector' | 'appSettings';
type Member = { id: string; name: string; email: string; role: string; flat_no?: string; status: string };
type SubRecord = {
  id: string; user_id: string; plan: string; status: string;
  started_at: string; expires_at: string | null; remark: string | null;
  razorpay_payment_id: string | null;
  users: { name: string; email: string; role: string; buildings: { name: string } | null } | null;
};

function ActionCard({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.actionCard, { borderColor: color + '40' }]} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={26} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalType>('none');
  const [submitting, setSubmitting] = useState(false);

  // create building form
  const [bForm, setBForm] = useState({
    name: '',
    address: '',
    has_wings: false,
    wings: '',
    late_fees_enabled: false,
    late_fees_amount: '',
    water_reading_enabled: false,
    payment_methods: ['Online', 'Cash', 'Cheque']
  });

  // create pramukh form
  const [pBuilding, setPBuilding] = useState<Building | null>(null);
  const [pForm, setPForm] = useState({ name: '', email: '', password: '' });

  // members
  const [membersBuilding, setMembersBuilding] = useState<Building | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // subscriptions
  const [subs, setSubs] = useState<SubRecord[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [grantForm, setGrantForm] = useState({ user_id: '', plan: 'monthly', months: '1', remark: '' });
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // building selector for module navigation
  const [selectedModuleRoute, setSelectedModuleRoute] = useState<string>('');
  const [buildingSearchQuery, setBuildingSearchQuery] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  
  // App Config Settings
  const [appConfig, setAppConfig] = useState({
    version: '',
    maintenance_mode: false,
    maintenance_message: ''
  });
  const [configLoading, setConfigLoading] = useState(false);

  const filteredBuildings = buildings.filter(b =>
    b.name.toLowerCase().includes(buildingSearchQuery.toLowerCase()) ||
    b.address?.toLowerCase().includes(buildingSearchQuery.toLowerCase()) ||
    b.id.toLowerCase().includes(buildingSearchQuery.toLowerCase())
  );

  useEffect(() => { fetchBuildings(); }, []);

  const fetchBuildings = async () => {
    try { const r = await api.get('/buildings'); setBuildings(r.data); }
    catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
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
        payment_methods: bForm.payment_methods
      });
      setBForm({
        name: '',
        address: '',
        has_wings: false,
        wings: '',
        late_fees_enabled: false,
        late_fees_amount: '',
        water_reading_enabled: false,
        payment_methods: ['Online', 'Cash', 'Cheque']
      });
      closeModal();
      fetchBuildings();
      Alert.alert('Done', 'Building created');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const createPramukh = async () => {
    if (!pBuilding) return Alert.alert('Error', 'Select a building');
    if (!pForm.name.trim() || !pForm.email.trim() || !pForm.password.trim())
      return Alert.alert('Error', 'All fields are required');
    setSubmitting(true);
    try {
      await api.post('/buildings/pramukh', {
        building_id: pBuilding.id,
        name: pForm.name.trim(),
        email: pForm.email.trim().toLowerCase(),
        password: pForm.password,
      });
      setPForm({ name: '', email: '', password: '' });
      setPBuilding(null);
      closeModal();
      Alert.alert('Done', 'Pramukh created');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const openMembers = async (b: Building) => {
    setMembersBuilding(b);
    setModal('members');
    setMembersLoading(true);
    try { const r = await api.get(`/buildings/members/${b.id}`); setMembers(r.data); }
    catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
    finally { setMembersLoading(false); }
  };

  const openSubscriptions = async () => {
    setModal('subscriptions');
    setSubsLoading(true);
    try { const r = await api.get('/subscriptions/all'); setSubs(r.data); }
    catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
    finally { setSubsLoading(false); }
  };

  const openGrantSub = async () => {
    // load all users for picker
    try {
      const r = await api.get('/buildings');
      // fetch members from all buildings
      const all: { id: string; name: string; email: string }[] = [];
      for (const b of r.data) {
        const m = await api.get(`/buildings/members/${b.id}`);
        m.data.forEach((u: any) => { if (!all.find(x => x.id === u.id)) all.push({ id: u.id, name: u.name, email: u.email }); });
      }
      setAllUsers(all);
    } catch { }
    setGrantForm({ user_id: '', plan: 'monthly', months: '1', remark: '' });
    setUserDropdownOpen(false);
    setUserSearch('');
    setModal('grantSub');
  };

  const grantSubscription = async () => {
    if (!grantForm.user_id) return Alert.alert('Error', 'Select a user');
    if (!grantForm.remark.trim()) return Alert.alert('Error', 'Remark is required — add who is handling this');
    setSubmitting(true);
    try {
      await api.post('/subscriptions/grant', {
        user_id: grantForm.user_id,
        plan: grantForm.plan,
        months: grantForm.plan === 'monthly' ? Number(grantForm.months) : undefined,
        remark: grantForm.remark.trim(),
      });
      closeModal();
      Alert.alert('Done', 'Subscription granted');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const revokeSubscription = async (user_id: string, name: string) => {
    Alert.alert('Revoke Subscription', `Revoke subscription for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          try {
            await api.post('/subscriptions/revoke', { user_id });
            setSubs(prev => prev.map(s => s.user_id === user_id ? { ...s, status: 'cancelled' } : s));
          } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
        }
      },
    ]);
  };

  const navigateTo = (route: string, b: Building) => {
    router.push({ pathname: route as any, params: { building_id: b.id, building_name: b.name } });
    setSelectedBuilding(null);
  };

  const openAppSettings = async () => {
    setModal('appSettings');
    setConfigLoading(true);
    try {
      const r = await api.get('/app-config');
      setAppConfig(r.data);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load app config');
    } finally {
      setConfigLoading(false);
    }
  };

  const updateConfigKey = async (key: string, value: any) => {
    // For maintenance_mode, we show a confirmation alert first
    if (key === 'maintenance_mode') {
      const isEnabling = value === 'true';
      Alert.alert(
        isEnabling ? 'Enable Maintenance Mode?' : 'Disable Maintenance Mode?',
        isEnabling 
          ? 'This will block all non-admin users from using the app. Are you sure?'
          : 'This will restore access for all users. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: isEnabling ? 'Enable' : 'Disable', onPress: () => performUpdate(key, value) }
        ]
      );
    } else {
      performUpdate(key, value);
    }
  };

  const performUpdate = async (key: string, value: any) => {
    const stateKey = key === 'app_version' ? 'version' : key;
    const previousValue = (appConfig as any)[stateKey];
    
    // 1. Optimistic Update (Immediate UI response)
    // Convert 'true'/'false' strings to actual booleans for the state
    const displayValue = key === 'maintenance_mode' ? value === 'true' : value;
    setAppConfig(prev => ({ ...prev, [stateKey]: displayValue }));

    try {
      setSubmitting(true);
      await api.patch('/app-config', { key, value });
    } catch (e: any) {
      // 2. Rollback on error
      setAppConfig(prev => ({ ...prev, [stateKey]: previousValue }));
      Alert.alert('Error', e.response?.data?.error || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  const openBuildingSelector = (route: string) => {
    setSelectedModuleRoute(route);
    setModal('buildingSelector');
    setBuildingSearchQuery('');
  };

  const handleBuildingClick = (b: Building) => {
    if (selectedBuilding?.id === b.id) {
      setSelectedBuilding(null);
    } else {
      setSelectedBuilding(b);
    }
  };

  const copyBuildingId = async (buildingId: string, buildingName: string) => {
    Clipboard.setString(buildingId);
    Alert.alert('Copied!', `Building ID for "${buildingName}" copied to clipboard`);
  };

  const roleColor = (r: string) =>
    r === 'pramukh' ? Colors.primary : r === 'user' ? Colors.success : Colors.textMuted;

  const BUILD_ACTIONS = [
    { route: '/maintenance', icon: 'wallet', color: '#10B981', label: 'Maintenance' },
    { route: '/announcements', icon: 'megaphone', color: '#F59E0B', label: 'Notices' },
    { route: '/visitors', icon: 'people', color: '#6366F1', label: 'Visitors' },
    { route: '/parking', icon: 'car', color: '#0EA5E9', label: 'Parking' },
  ];



  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSub}>{buildings.length} building{buildings.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBuildings(); }} />}
        >
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <ActionCard icon="business" label="New Building" color={Colors.primary} onPress={() => setModal('createBuilding')} />
            <ActionCard icon="person-add" label="New Pramukh" color="#7C3AED" onPress={() => setModal('createPramukh')} />
          </View>
          <View style={styles.actionsRow}>
            <ActionCard icon="globe-outline" label="Web Inquiries" color="#F59E0B" onPress={() => router.push('/website-contacts' as any)} />
            <ActionCard icon="settings-outline" label="App Settings" color="#64748B" onPress={openAppSettings} />
          </View>
          <View style={styles.actionsRow}>
            <ActionCard icon="gift" label="Grant Sub" color="#EC4899" onPress={openGrantSub} />
            <View style={{ flex: 1 }} />
          </View>

          <Text style={styles.sectionTitle}>Buildings</Text>

          {/* Search bar */}
          {buildings.length > 0 && (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search buildings..."
                value={buildingSearchQuery}
                onChangeText={setBuildingSearchQuery}
                placeholderTextColor={Colors.textMuted}
              />
              {buildingSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setBuildingSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {filteredBuildings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{buildingSearchQuery ? '🔍' : '🏢'}</Text>
              <Text style={styles.emptyTitle}>{buildingSearchQuery ? 'No buildings found' : 'No buildings yet'}</Text>
              <Text style={styles.emptyText}>{buildingSearchQuery ? 'Try a different search term' : 'Create your first building above'}</Text>
            </View>
          ) : filteredBuildings.map((b) => (
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
                      <Text style={styles.buildingId}>ID: {b.id}</Text>
                      <TouchableOpacity
                        style={styles.copyBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          copyBuildingId(b.id, b.name);
                        }}
                      >
                        <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <Ionicons
                  name={selectedBuilding?.id === b.id ? "chevron-up" : "chevron-down"}
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
          ))}
        </ScrollView>
      )}

      {/* ── Create Building ── */}
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

      {/* ── Create Pramukh ── */}
      <Modal visible={modal === 'createPramukh'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Pramukh</Text>
            <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <BuildingDropdown buildings={buildings} loading={false} selected={pBuilding} onSelect={setPBuilding} label="Assign to Building *" />
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={pForm.name} onChangeText={(v) => setPForm({ ...pForm, name: v })} placeholder="Full name" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} value={pForm.email} onChangeText={(v) => setPForm({ ...pForm, email: v })} placeholder="pramukh@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Password *</Text>
            <TextInput style={styles.input} value={pForm.password} onChangeText={(v) => setPForm({ ...pForm, password: v })} placeholder="Min 6 characters" secureTextEntry placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#7C3AED' }]} onPress={createPramukh} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Pramukh</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Members ── */}
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
                <View style={styles.memberCard}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{item.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{item.name}</Text>
                    <Text style={styles.memberEmail}>{item.email}</Text>
                    {item.flat_no && <Text style={styles.memberFlat}>Flat {item.flat_no}</Text>}
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor(item.role) + '20' }]}>
                    <Text style={[styles.roleText, { color: roleColor(item.role) }]}>{item.role}</Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* ── All Subscriptions ── */}
      <Modal visible={modal === 'subscriptions'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Subscriptions</Text>
              <Text style={styles.modalSub}>{subs.length} total</Text>
            </View>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          {subsLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
          ) : (
            <FlatList
              data={subs}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={styles.empty}>No subscriptions yet</Text>}
              renderItem={({ item }) => {
                const isActive = item.status === 'active';
                const isLifetime = item.plan === 'lifetime';
                const isAdminGrant = item.razorpay_payment_id === 'admin_grant';
                const statusColor = isActive ? Colors.success : item.status === 'expired' ? '#F59E0B' : Colors.danger;
                return (
                  <View style={styles.subCard}>
                    <View style={styles.subCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{item.users?.name || '—'}</Text>
                        <Text style={styles.memberEmail}>{item.users?.email || '—'}</Text>
                        {item.users?.buildings?.name && (
                          <Text style={styles.memberFlat}>{item.users.buildings.name}</Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={[styles.roleBadge, { backgroundColor: statusColor + '20' }]}>
                          <Text style={[styles.roleText, { color: statusColor }]}>{item.status}</Text>
                        </View>
                        <Text style={styles.subPlan}>{isLifetime ? '♾ Lifetime' : '📅 Monthly'}</Text>
                        {isAdminGrant && <Text style={styles.subGranted}>Admin Grant</Text>}
                      </View>
                    </View>

                    {/* Remark row */}
                    {item.remark ? (
                      <View style={styles.remarkRow}>
                        <Ionicons name="chatbox-ellipses-outline" size={14} color="#7C3AED" />
                        <Text style={styles.remarkText}>{item.remark}</Text>
                      </View>
                    ) : (
                      <View style={styles.remarkRow}>
                        <Ionicons name="chatbox-ellipses-outline" size={14} color={Colors.textMuted} />
                        <Text style={[styles.remarkText, { color: Colors.textMuted, fontStyle: 'italic' }]}>No remark</Text>
                      </View>
                    )}

                    {!isLifetime && item.expires_at && (
                      <Text style={styles.subExpiry}>
                        Expires: {new Date(item.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    )}

                    {isActive && (
                      <TouchableOpacity
                        style={styles.revokeBtn}
                        onPress={() => revokeSubscription(item.user_id, item.users?.name || 'user')}
                      >
                        <Ionicons name="close-circle-outline" size={14} color={Colors.danger} />
                        <Text style={styles.revokeBtnText}>Revoke</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* ── Grant Subscription ── */}
      <Modal visible={modal === 'grantSub'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Grant Subscription</Text>
            <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>User *</Text>
            {(() => {
              const selectedUser = allUsers.find(u => u.id === grantForm.user_id);
              const filtered = allUsers.filter(u =>
                !userSearch.trim() ||
                u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                u.email.toLowerCase().includes(userSearch.toLowerCase())
              );
              return (
                <View style={{ marginBottom: 4 }}>
                  <TouchableOpacity
                    style={[styles.dropdownTrigger, userDropdownOpen && styles.dropdownTriggerOpen]}
                    onPress={() => { setUserDropdownOpen(o => !o); setUserSearch(''); }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownTriggerAvatar}>
                      <Text style={styles.dropdownTriggerAvatarText}>
                        {selectedUser ? selectedUser.name[0].toUpperCase() : '?'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      {selectedUser ? (
                        <>
                          <Text style={styles.dropdownTriggerName}>{selectedUser.name}</Text>
                          <Text style={styles.dropdownTriggerEmail}>{selectedUser.email}</Text>
                        </>
                      ) : (
                        <Text style={styles.dropdownTriggerPlaceholder}>
                          {allUsers.length === 0 ? 'Loading users...' : 'Select a user'}
                        </Text>
                      )}
                    </View>
                    <Ionicons name={userDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
                  </TouchableOpacity>

                  {userDropdownOpen && (
                    <View style={styles.dropdownMenu}>
                      <View style={styles.dropdownSearch}>
                        <Ionicons name="search" size={16} color={Colors.textMuted} />
                        <TextInput
                          style={styles.dropdownSearchInput}
                          value={userSearch}
                          onChangeText={setUserSearch}
                          placeholder="Search by name or email..."
                          placeholderTextColor={Colors.textMuted}
                          autoFocus
                        />
                        {userSearch.length > 0 && (
                          <TouchableOpacity onPress={() => setUserSearch('')}>
                            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                        {filtered.length === 0 ? (
                          <Text style={styles.dropdownEmpty}>No users found</Text>
                        ) : filtered.map(u => {
                          const active = grantForm.user_id === u.id;
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                              onPress={() => { setGrantForm({ ...grantForm, user_id: u.id }); setUserDropdownOpen(false); setUserSearch(''); }}
                            >
                              <View style={[styles.dropdownItemAvatar, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                <Text style={[styles.dropdownItemAvatarText, active && { color: Colors.white }]}>
                                  {u.name[0].toUpperCase()}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.dropdownItemName, active && { color: Colors.white }]}>{u.name}</Text>
                                <Text style={[styles.dropdownItemEmail, active && { color: 'rgba(255,255,255,0.75)' }]}>{u.email}</Text>
                              </View>
                              {active && <Ionicons name="checkmark-circle" size={18} color={Colors.white} />}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              );
            })()}

            <Text style={styles.label}>Plan *</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {['monthly', 'yearly', 'lifetime'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.planToggle, grantForm.plan === p && styles.planToggleActive]}
                  onPress={() => setGrantForm({ ...grantForm, plan: p })}
                >
                  <Text style={[styles.planToggleText, grantForm.plan === p && { color: Colors.white }]}>
                    {p === 'monthly' ? '📅 Monthly' : p === 'yearly' ? '⭐ Yearly' : '♾ Lifetime'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {grantForm.plan === 'monthly' && (<>
              <Text style={styles.label}>Months *</Text>
              <TextInput
                style={styles.input}
                value={grantForm.months}
                onChangeText={(v) => setGrantForm({ ...grantForm, months: v })}
                placeholder="e.g. 1"
                keyboardType="number-pad"
                placeholderTextColor={Colors.textMuted}
              />
            </>
            )}

            <Text style={styles.label}>Remark * <Text style={{ fontWeight: '400', color: Colors.textMuted }}>(who handled this?)</Text></Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={grantForm.remark}
              onChangeText={(v) => setGrantForm({ ...grantForm, remark: v })}
              placeholder="e.g. Collected cash from client — handled by Ravi"
              placeholderTextColor={Colors.textMuted}
              multiline
            />

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#10B981' }]} onPress={grantSubscription} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Grant Subscription</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── App Settings ── */}
      <Modal visible={modal === 'appSettings'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>App Configuration</Text>
            <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          
          {configLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.configCard}>
                <Text style={styles.label}>App Version (Live on Stores)</Text>
                <View style={styles.inlineActionRow}>
                  <TextInput 
                    style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                    value={appConfig.version} 
                    onChangeText={(v) => setAppConfig({ ...appConfig, version: v })} 
                    placeholder="e.g. 1.13.0" 
                  />
                  <TouchableOpacity 
                    style={styles.inlineUpdateBtn} 
                    onPress={() => updateConfigKey('app_version', appConfig.version)}
                    disabled={submitting}
                  >
                    <Text style={styles.inlineUpdateBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.switchSub}>Changing this triggers the "Update Available" popup for users on older versions.</Text>
              </View>

              <View style={styles.configCard}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Maintenance Mode</Text>
                    <Text style={styles.switchSub}>Block all users from using the app</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.switch, appConfig.maintenance_mode && styles.switchOn]}
                    onPress={() => updateConfigKey('maintenance_mode', !appConfig.maintenance_mode ? 'true' : 'false')}
                    disabled={submitting}
                  >
                    <View style={[styles.switchThumb, appConfig.maintenance_mode && styles.switchThumbOn]} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.label, { marginTop: 16 }]}>Maintenance Message</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  value={appConfig.maintenance_message}
                  onChangeText={(v) => setAppConfig({ ...appConfig, maintenance_message: v })}
                  placeholder="Tell users why the app is down..."
                  multiline
                />
                <TouchableOpacity 
                  style={[styles.submitBtn, { marginTop: 0 }]} 
                  onPress={() => updateConfigKey('maintenance_message', appConfig.maintenance_message)}
                  disabled={submitting}
                >
                  <Text style={styles.submitBtnText}>Update Message</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12, marginTop: 8 },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  actionIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  buildingCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  buildingNameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  buildingTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  buildingIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  buildingName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  buildingAddr: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
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
  buildingActions: { flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  miniBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, gap: 4 },
  miniLabel: { fontSize: 10, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 24, marginBottom: 30 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg, borderRadius: 12, padding: 14, marginBottom: 10 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  memberName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  memberEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  memberFlat: { fontSize: 12, color: Colors.primary, marginTop: 2, fontWeight: '600' },
  roleBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 15 },
  // Subscription cards
  subCard: { backgroundColor: Colors.bg, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  subCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  subPlan: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  subGranted: { fontSize: 10, color: '#7C3AED', fontWeight: '700', backgroundColor: '#F3E8FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  subExpiry: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  remarkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#F5F3FF', borderRadius: 8, padding: 8, marginTop: 4 },
  remarkText: { fontSize: 13, color: '#7C3AED', fontWeight: '600', flex: 1 },
  revokeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-end' },
  revokeBtnText: { fontSize: 12, color: Colors.danger, fontWeight: '700' },
  // Grant sub
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 12, backgroundColor: Colors.bg },
  dropdownTriggerOpen: { borderColor: Colors.primary, backgroundColor: Colors.white },
  dropdownTriggerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  dropdownTriggerAvatarText: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  dropdownTriggerName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  dropdownTriggerEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  dropdownTriggerPlaceholder: { fontSize: 14, color: Colors.textMuted },
  dropdownMenu: { borderWidth: 1.5, borderColor: Colors.primary + '40', borderRadius: 12, backgroundColor: Colors.white, marginTop: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 6, overflow: 'hidden' },
  dropdownSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg },
  dropdownSearchInput: { flex: 1, fontSize: 14, color: Colors.text },
  dropdownEmpty: { textAlign: 'center', color: Colors.textMuted, padding: 16, fontSize: 13 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemActive: { backgroundColor: Colors.primary },
  dropdownItemAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  dropdownItemAvatarText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  dropdownItemName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  dropdownItemEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  planToggle: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  planToggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  planToggleText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  // Switch styles
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, backgroundColor: Colors.bg, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  switchLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  switchSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  switch: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E5E7EB', padding: 2 },
  switchOn: { backgroundColor: Colors.primary },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.white },
  switchThumbOn: { alignSelf: 'flex-end' },
  // Checkbox styles
  checkboxGroup: { flexDirection: 'row', gap: 16, marginTop: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxText: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  configCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
  inlineActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  inlineUpdateBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 16, height: 48, justifyContent: 'center', alignItems: 'center' },
  inlineUpdateBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
});
