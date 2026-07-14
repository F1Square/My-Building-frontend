import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, RefreshControl, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, Animated, Easing,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useBuildings } from '../hooks/useBuildings';
import BuildingDropdown from '../components/BuildingDropdown';
import type { Building } from '../hooks/useBuildings';
import { useActivityLog } from '../hooks/useActivityLog';
import ParkingReportDetailModal, { ParkingReport } from '../components/ParkingReportDetailModal';
import ParkingOwnerDetailModal, { ParkingOwner } from '../components/ParkingOwnerDetailModal';
import { ModuleHeader, ModuleHeaderIconButton, ModuleHeaderTextButton } from '../components/ModuleHeader';
import { useKeyboardPad } from '../hooks/useKeyboardPad';

type Tab = 'vehicles' | 'reports';

function formatWingFlat(user?: { wing?: string | null; flat_no?: string | null } | null) {
  if (!user?.flat_no) return '';
  return user.wing ? `${user.wing}-${user.flat_no}` : String(user.flat_no);
}

function VehicleDropdown({ vehicles, selected, onSelect, isAdmin, hasBuilding }: {
  vehicles: any[];
  selected: string;
  onSelect: (vn: string) => void;
  isAdmin: boolean;
  hasBuilding: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ddStyles = makeDdStyles(Colors);

  const selectedVehicle = vehicles.find(v => v.vehicle_number === selected);
  const displayLabel = selectedVehicle
    ? `${selectedVehicle.vehicle_type === 'four_wheeler' ? '🚗' : '🏍️'}  ${selectedVehicle.vehicle_number}`
    : 'Select vehicle number';

  if (!hasBuilding) {
    return (
      <View style={ddStyles.trigger}>
        <Ionicons name="car-outline" size={18} color={Colors.textMuted} />
        <Text style={ddStyles.placeholder}>Select a building first</Text>
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={ddStyles.trigger}>
        <Ionicons name="car-outline" size={18} color={Colors.textMuted} />
        <Text style={ddStyles.placeholder}>No vehicles registered</Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 4 }}>
      <TouchableOpacity style={[ddStyles.trigger, open && ddStyles.triggerOpen]} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Ionicons name="car-outline" size={18} color={selected ? Colors.primary : Colors.textMuted} />
        <Text style={[ddStyles.triggerText, selected && ddStyles.triggerTextSelected]}>{displayLabel}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      {open && (
        <View style={ddStyles.menu}>
          {vehicles.map((v: any) => {
            const active = selected === v.vehicle_number;
            const wingFlat = formatWingFlat(v.users);
            return (
              <TouchableOpacity
                key={v.id}
                style={[ddStyles.item, active && ddStyles.itemActive]}
                onPress={() => { onSelect(v.vehicle_number); setOpen(false); }}
              >
                <Text style={ddStyles.itemEmoji}>{v.vehicle_type === 'four_wheeler' ? '🚗' : '🏍️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[ddStyles.itemText, active && ddStyles.itemTextActive]}>{v.vehicle_number}</Text>
                  {v.users ? (
                    <Text style={ddStyles.itemSub}>
                      {v.users.name}{wingFlat ? ` · ${wingFlat}` : ''}
                    </Text>
                  ) : null}
                </View>
                {active && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeDdStyles = (Colors: any) => StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    padding: 12, backgroundColor: Colors.bg, marginBottom: 12,
  },
  triggerOpen: { borderColor: Colors.primary, backgroundColor: Colors.white },
  triggerText: { flex: 1, fontSize: 15, color: Colors.textMuted },
  triggerTextSelected: { color: Colors.text, fontWeight: '600' },
  placeholder: { flex: 1, fontSize: 15, color: Colors.textMuted },
  menu: {
    borderWidth: 1.5, borderColor: Colors.primary + '40', borderRadius: 10,
    backgroundColor: Colors.white, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  itemActive: { backgroundColor: Colors.primary + '10' },
  itemEmoji: { fontSize: 18 },
  itemText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  itemTextActive: { color: Colors.primary },
  itemSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
});

export default function ParkingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const keyboardPad = useKeyboardPad();
  const isAdmin = user?.role === 'admin';
  const params = useLocalSearchParams<{ building_id?: string; building_name?: string }>();

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  useEffect(() => {
    if (params.building_id && params.building_name && isAdmin) {
      setSelectedBuilding({ id: params.building_id, name: params.building_name });
    }
  }, [params.building_id]);

  const [tab, setTab] = useState<Tab>('vehicles');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showEditVehicle, setShowEditVehicle] = useState<any>(null);
  const [vehicleForm, setVehicleForm] = useState({ vehicle_number: '', vehicle_type: 'two_wheeler' });
  const [editForm, setEditForm] = useState({ vehicle_number: '', vehicle_type: 'two_wheeler' });
  const [reportForm, setReportForm] = useState({ description: '', vehicle_number: '', location: '' });
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState<ParkingReport | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<ParkingOwner | null>(null);

  // For admin report modal, track selected building separately
  const [reportBuilding, setReportBuilding] = useState<Building | null>(null);

  const fetchData = async () => {
    try {
      const buildingId = isAdmin ? selectedBuilding?.id : undefined;
      const suffix = buildingId ? `?building_id=${buildingId}` : '';
      const [vRes, rRes] = await Promise.all([
        api.get(`/vehicles/building${suffix}`),
        api.get(`/vehicles/reports${suffix}`),
      ]);
      setVehicles(vRes.data);
      setReports(rRes.data);
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed to load', 4000);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const { logEvent } = useActivityLog();
  useEffect(() => { fetchData(); logEvent('open_parking', 'vehicles'); }, [selectedBuilding]);

  const addVehicle = async () => {
    if (!vehicleForm.vehicle_number.trim()) return Alert.error('Error', 'Vehicle number is required', 4000);
    setSubmitting(true);
    try {
      await api.post('/vehicles', vehicleForm);
      setShowAddVehicle(false);
      setVehicleForm({ vehicle_number: '', vehicle_type: 'two_wheeler' });
      fetchData();
      Alert.success('Added', 'Vehicle registered successfully', 4000);
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed to add vehicle', 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const closeReportSheet = useCallback(() => {
    setShowReport(false);
    setReportForm({ description: '', vehicle_number: '', location: '' });
    setReportBuilding(null);
  }, []);

  const reportBackdrop = useRef(new Animated.Value(0)).current;
  const reportSheetY = useRef(new Animated.Value(48)).current;
  const reportClosing = useRef(false);

  useEffect(() => {
    if (!showReport) return;
    reportClosing.current = false;
    reportBackdrop.setValue(0);
    reportSheetY.setValue(56);
    Animated.parallel([
      Animated.timing(reportBackdrop, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(reportSheetY, {
        toValue: 0,
        damping: 22,
        stiffness: 240,
        mass: 0.85,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showReport, reportBackdrop, reportSheetY]);

  const dismissReportSheet = useCallback(() => {
    if (reportClosing.current) return;
    reportClosing.current = true;
    Animated.parallel([
      Animated.timing(reportBackdrop, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(reportSheetY, {
        toValue: 64,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) closeReportSheet();
      else reportClosing.current = false;
    });
  }, [closeReportSheet, reportBackdrop, reportSheetY]);

  const submitReport = async () => {
    if (isAdmin && !reportBuilding) return Alert.error('Error', 'Please select a building', 4000);
    const desc = reportForm.description.trim();
    if (!desc) return Alert.error('Error', 'Description is required', 4000);
    setSubmitting(true);
    try {
      await api.post('/vehicles/report', {
        ...reportForm,
        ...(isAdmin && reportBuilding ? { building_id: reportBuilding.id } : {}),
      });
      dismissReportSheet();
      fetchData();
      Alert.success('Reported', 'Parking report submitted. Pramukh has been notified.', 4000);
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed to submit report', 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const adminDeleteVehicle = (id: string, num: string) => {
    Alert.alert('Delete Vehicle', `Delete ${num}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/vehicles/admin/${id}`);
          setVehicles(prev => prev.filter(v => v.id !== id));
        } catch (e: any) { Alert.error('Error', e.response?.data?.error || 'Failed', 4000); }
      }},
    ]);
  };

  const openAdminEdit = (item: any) => {
    setEditForm({ vehicle_number: item.vehicle_number, vehicle_type: item.vehicle_type });
    setShowEditVehicle(item);
  };

  const saveAdminEdit = async () => {
    if (!showEditVehicle) return;
    setSubmitting(true);
    try {
      const res = await api.patch(`/vehicles/admin/${showEditVehicle.id}`, editForm);
      setVehicles(prev => prev.map(v => v.id === showEditVehicle.id ? { ...v, ...res.data.vehicle } : v));
      setShowEditVehicle(null);
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed', 4000);
    } finally { setSubmitting(false); }
  };

  const groupedVehicles = useMemo(() => {
    const map = new Map<string, { user: any, vehicles: any[] }>();
    const q = search.trim().toLowerCase();
    const filteredList = vehicles.filter((v) => {
      if (!q) return true;
      const wingFlat = formatWingFlat(v.users).toLowerCase();
      return (
        v.vehicle_number.toUpperCase().includes(q.toUpperCase()) ||
        (v.users?.name && v.users.name.toLowerCase().includes(q)) ||
        (v.users?.wing && String(v.users.wing).toLowerCase().includes(q)) ||
        (v.users?.flat_no && String(v.users.flat_no).toLowerCase().includes(q)) ||
        (wingFlat && wingFlat.includes(q))
      );
    });

    filteredList.forEach(v => {
      const userId = v.users?.id || 'unassigned_' + v.id;
      if (!map.has(userId)) {
        map.set(userId, { user: v.users, vehicles: [] });
      }
      map.get(userId)!.vehicles.push(v);
    });
    
    return Array.from(map.values());
  }, [vehicles, search]);

  const openOwnerDetails = useCallback((user: ParkingOwner | null | undefined) => {
    if (!user) return;
    setSelectedOwner(user);
  }, []);

  const renderUserCard = ({ item }: { item: { user: any, vehicles: any[] } }) => {
    const hasUser = !!item.user;
    const wingFlat = formatWingFlat(item.user);
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}
          onPress={() => openOwnerDetails(item.user)}
          disabled={!hasUser}
          activeOpacity={hasUser ? 0.7 : 1}
          accessibilityRole="button"
          accessibilityLabel="View resident details"
        >
          <View style={styles.userIconBadge}>
            <Ionicons name="person" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{hasUser ? (item.user.name || 'Member') : 'Unassigned Vehicle'}</Text>
            {hasUser && !!wingFlat && (
              <Text style={styles.userFlat}>{wingFlat}</Text>
            )}
          </View>
          {hasUser && (
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          )}
        </TouchableOpacity>

        <View style={styles.vehiclesContainer}>
          {item.vehicles.map(v => (
            <View key={v.id} style={styles.vehicleBadgeContainer}>
              <View style={[styles.vehicleBadge, { backgroundColor: v.vehicle_type === 'four_wheeler' ? Colors.primary + '15' : Colors.accent + '15' }]}>
                <Text style={styles.vehicleBadgeEmoji}>{v.vehicle_type === 'four_wheeler' ? '🚗' : '🏍️'}</Text>
                <Text style={styles.vehicleBadgeText}>{v.vehicle_number}</Text>
              </View>
              {isAdmin && (
                <View style={styles.vehicleActionsRow}>
                  <TouchableOpacity style={styles.actionIconBtn} onPress={() => openAdminEdit(v)}>
                    <Ionicons name="pencil-outline" size={14} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionIconBtn} onPress={() => adminDeleteVehicle(v.id, v.vehicle_number)}>
                    <Ionicons name="trash-outline" size={14} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderReport = ({ item }: { item: ParkingReport }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setSelectedReport(item)}
      activeOpacity={0.75}
    >
      <View style={styles.reportHeader}>
        <Text style={styles.reportIcon}>🚨</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.reportDesc} numberOfLines={2}>{item.description}</Text>
          {item.vehicle_number && <Text style={styles.reportVehicle}>Vehicle: {item.vehicle_number}</Text>}
          {item.location && <Text style={styles.reportLocation}>📍 {item.location}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </View>
      <View style={styles.reportFooter}>
        <Text style={styles.reportBy}>Reported by {item.users?.name || item.reported_by || '—'}</Text>
        <Text style={styles.reportTime}>{new Date(item.created_at).toLocaleDateString('en-IN')}</Text>
      </View>
    </TouchableOpacity>
  );

  

  return (
    <View style={styles.container}>
      <ModuleHeader
        title={t('parking')}
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {user?.role === 'user' && (
              <ModuleHeaderIconButton icon="add" onPress={() => setShowAddVehicle(true)} />
            )}
            <ModuleHeaderTextButton
              icon="warning"
              label={t('report')}
              onPress={() => setShowReport(true)}
            />
          </View>
        }
      />

      {/* Admin building filter */}
      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown
            buildings={buildings}
            loading={buildingsLoading}
            selected={selectedBuilding}
            onSelect={setSelectedBuilding}
            label="Filter by Building"
          />
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'vehicles' && styles.tabBtnActive]} onPress={() => setTab('vehicles')}>
          <Text style={[styles.tabBtnText, tab === 'vehicles' && styles.tabBtnTextActive]}>{t('vehicles')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'reports' && styles.tabBtnActive]} onPress={() => setTab('reports')}>
          <Text style={[styles.tabBtnText, tab === 'reports' && styles.tabBtnTextActive]}>{t('reports')}</Text>
        </TouchableOpacity>
      </View>

      {tab === 'vehicles' && (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vehicle number..."
            value={search}
            onChangeText={setSearch}
            autoCapitalize="characters"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : tab === 'vehicles' ? (
        <FlatList
          data={groupedVehicles}
          keyExtractor={(i) => i.user?.id || 'u_' + i.vehicles[0].id}
          renderItem={renderUserCard}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isAdmin && !selectedBuilding ? t('selectBuildingToView') : t('noVehicles')}
            </Text>
          }
        />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(i) => i.id}
          renderItem={renderReport}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isAdmin && !selectedBuilding ? t('selectBuildingToView') : t('noReports')}
            </Text>
          }
        />
      )}

      {/* Add Vehicle Modal */}
      <Modal visible={showAddVehicle} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('addVehicle')}</Text>
            <TouchableOpacity onPress={() => setShowAddVehicle(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Vehicle Number *</Text>
          <TextInput style={styles.input} value={vehicleForm.vehicle_number} onChangeText={(v) => setVehicleForm({ ...vehicleForm, vehicle_number: v })} placeholder="e.g. GJ06HY2323" autoCapitalize="characters" placeholderTextColor={Colors.textMuted} />
          <Text style={styles.label}>Vehicle Type</Text>
          <View style={styles.typeRow}>
            {[{ key: 'two_wheeler', label: '🏍️ Two Wheeler' }, { key: 'four_wheeler', label: '🚗 Four Wheeler' }].map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeBtn, vehicleForm.vehicle_type === t.key && styles.typeBtnActive]}
                onPress={() => setVehicleForm({ ...vehicleForm, vehicle_type: t.key })}
              >
                <Text style={[styles.typeBtnText, vehicleForm.vehicle_type === t.key && styles.typeBtnTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.submitBtn} onPress={addVehicle} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{t('addVehicle')}</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Admin Edit Vehicle Modal */}
      <Modal visible={!!showEditVehicle} animationType="slide" presentationStyle="pageSheet">
        {showEditVehicle && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Vehicle</Text>
              <TouchableOpacity onPress={() => setShowEditVehicle(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Vehicle Number *</Text>
            <TextInput style={styles.input} value={editForm.vehicle_number}
              onChangeText={v => setEditForm({ ...editForm, vehicle_number: v.toUpperCase() })}
              placeholder="e.g. GJ05HR4533" autoCapitalize="characters"
              placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Vehicle Type</Text>
            <View style={styles.typeRow}>
              {[{ key: 'two_wheeler', label: '🏍️ Two Wheeler' }, { key: 'four_wheeler', label: '🚗 Four Wheeler' }].map(t => (
                <TouchableOpacity key={t.key}
                  style={[styles.typeBtn, editForm.vehicle_type === t.key && styles.typeBtnActive]}
                  onPress={() => setEditForm({ ...editForm, vehicle_type: t.key })}
                >
                  <Text style={[styles.typeBtnText, editForm.vehicle_type === t.key && styles.typeBtnTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={saveAdminEdit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{t('saveChanges')}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* Report mis-parking — login/register keyboard scroll + smooth sheet transition */}
      <Modal
        visible={showReport}
        transparent
        animationType="none"
        onRequestClose={dismissReportSheet}
        statusBarTranslucent
      >
        <View style={styles.reportSheetRoot}>
          <Animated.View style={[styles.reportSheetBackdrop, { opacity: reportBackdrop }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={dismissReportSheet} />
          </Animated.View>

          <KeyboardAvoidingView
            style={styles.reportSheetKav}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            <Animated.View
              style={[
                styles.reportSheet,
                {
                  paddingBottom: Math.max(insets.bottom, 12),
                  transform: [{ translateY: reportSheetY }],
                },
              ]}
            >
              <View style={styles.reportSheetHandle} />
              <View style={styles.reportSheetHeader}>
                <Text style={styles.reportSheetTitle}>{t('reportMisparking')}</Text>
                <TouchableOpacity onPress={dismissReportSheet} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={28} color={Colors.border} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.reportSheetScrollView}
                contentContainerStyle={[
                  styles.reportSheetScroll,
                  { paddingBottom: Math.max(48, keyboardPad + 32) },
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator
                bounces
              >
                {isAdmin && (
                  <>
                    <BuildingDropdown
                      buildings={buildings}
                      loading={buildingsLoading}
                      selected={reportBuilding}
                      onSelect={(b) => { setReportBuilding(b); setReportForm(f => ({ ...f, vehicle_number: '' })); }}
                      label="Select Building *"
                    />
                    <View style={{ height: 8 }} />
                  </>
                )}

                <Text style={styles.label}>Description <Text style={{ color: Colors.danger }}>*</Text></Text>
                <Text style={styles.labelHint}>Describe the issue clearly</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={reportForm.description}
                  onChangeText={(v) => setReportForm({ ...reportForm, description: v })}
                  placeholder="e.g. Vehicle blocking the main gate entrance since morning..."
                  multiline
                  numberOfLines={4}
                  scrollEnabled={false}
                  placeholderTextColor={Colors.textMuted}
                />

                <Text style={styles.label}>Vehicle Number</Text>
                <Text style={styles.labelHint}>Select from registered vehicles in your building</Text>
                <VehicleDropdown
                  vehicles={
                    isAdmin && reportBuilding
                      ? vehicles.filter((v: any) => v.building_id === reportBuilding.id)
                      : vehicles
                  }
                  selected={reportForm.vehicle_number}
                  onSelect={(vn) => setReportForm(f => ({ ...f, vehicle_number: vn }))}
                  isAdmin={isAdmin}
                  hasBuilding={!isAdmin || !!reportBuilding}
                />

                <Text style={styles.label}>Location</Text>
                <TextInput
                  style={styles.input}
                  value={reportForm.location}
                  onChangeText={(v) => setReportForm({ ...reportForm, location: v })}
                  placeholder="e.g. Near Gate 2, Basement B1"
                  placeholderTextColor={Colors.textMuted}
                />

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: Colors.danger }, submitting && { opacity: 0.6 }]}
                  onPress={submitReport}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="warning-outline" size={18} color={Colors.white} />
                        <Text style={styles.submitBtnText}>{t('submitReport')}</Text>
                      </>
                  }
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ParkingReportDetailModal
        visible={!!selectedReport}
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />

      <ParkingOwnerDetailModal
        visible={!!selectedOwner}
        owner={selectedOwner}
        onClose={() => setSelectedOwner(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 8 },
  headerReportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  headerReportBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.white, marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabBtnTextActive: { color: Colors.white },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  userIconBadge: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary + '10', justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  userFlat: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  vehiclesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14 },
  vehicleBadgeContainer: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, overflow: 'hidden' },
  vehicleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  vehicleBadgeEmoji: { fontSize: 16 },
  vehicleBadgeText: { fontSize: 14, fontWeight: '800', color: Colors.text },
  vehicleActionsRow: { flexDirection: 'row', justifyContent: 'center', backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 8, gap: 16 },
  actionIconBtn: { padding: 4 },
  reportHeader: { flexDirection: 'row', gap: 10 },
  reportIcon: { fontSize: 22 },
  reportDesc: { fontSize: 14, fontWeight: '600', color: Colors.text },
  reportVehicle: { fontSize: 13, color: Colors.primary, marginTop: 4, fontWeight: '700' },
  reportLocation: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  reportFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  reportBy: { fontSize: 12, color: Colors.textMuted },
  reportTime: { fontSize: 12, color: Colors.textMuted },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 60, fontSize: 16 },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  typeBtnTextActive: { color: Colors.white },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20, marginBottom: 20, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  textArea: { height: 100, textAlignVertical: 'top' },
  labelHint: { fontSize: 12, color: Colors.textMuted, marginBottom: 6, marginTop: -4 },
  reportSheetRoot: { flex: 1, justifyContent: 'flex-end' },
  reportSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  reportSheetKav: { flex: 1, justifyContent: 'flex-end' },
  reportSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingTop: 8,
  },
  reportSheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 8,
  },
  reportSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  reportSheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, flex: 1, marginRight: 12 },
  reportSheetScrollView: { flexGrow: 0 },
  reportSheetScroll: { paddingHorizontal: 20 },
});
