import React, { useState, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ModuleHeader, ModuleHeaderIconButton } from '../components/ModuleHeader';
import BottomSheetModal, { BottomSheetTextInput } from '../components/BottomSheetModal';

const VEHICLE_RE = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/;

const TYPE_ICON: Record<string, string> = { two_wheeler: '🛵', four_wheeler: '🚗' };
const TYPE_LABEL: Record<string, string> = { two_wheeler: 'Two Wheeler', four_wheeler: 'Four Wheeler' };

type VehicleForm = { vehicle_number: string; vehicle_type: string };

const emptyForm = (): VehicleForm => ({ vehicle_number: '', vehicle_type: 'two_wheeler' });

export default function MyVehiclesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, hasActiveSubscription } = useAuth();
  const isLocked = user?.role !== 'admin' && !hasActiveSubscription;
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  const sheetOpen = showAdd || !!editing;

  const fetch = async () => {
    try {
      const res = await api.get('/vehicles/mine');
      setVehicles(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => {
    if (isLocked) {
      setLoading(false);
      return;
    }
    fetch();
  }, [isLocked]));

  const closeSheet = useCallback(() => {
    setShowAdd(false);
    setEditing(null);
    setForm(emptyForm());
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowAdd(true);
  };

  const openEdit = (item: any) => {
    setShowAdd(false);
    setEditing(item);
    setForm({
      vehicle_number: item.vehicle_number || '',
      vehicle_type: item.vehicle_type || 'two_wheeler',
    });
  };

  const saveVehicle = async () => {
    const num = form.vehicle_number.toUpperCase().replace(/\s/g, '');
    if (!num) return Alert.error('Error', 'Vehicle number is required', 4000);
    if (!VEHICLE_RE.test(num)) return Alert.error('Invalid', 'Enter a valid number e.g. GJ05HR4533', 4000);
    setSubmitting(true);
    try {
      if (editing) {
        const res = await api.patch(`/vehicles/${editing.id}`, {
          vehicle_number: num,
          vehicle_type: form.vehicle_type,
        });
        const updated = res.data?.vehicle;
        setVehicles(prev => prev.map(v => (v.id === editing.id ? { ...v, ...updated } : v)));
        Alert.success('Updated', 'Vehicle details saved', 4000);
      } else {
        await api.post('/vehicles', { vehicle_number: num, vehicle_type: form.vehicle_type });
        fetch();
        Alert.success('Added', 'Vehicle registered successfully', 4000);
      }
      closeSheet();
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || (editing ? 'Failed to update' : 'Failed to add vehicle'), 4000);
    } finally { setSubmitting(false); }
  };

  const deleteVehicle = (id: string, num: string) => {
    Alert.alert('Remove Vehicle', `Remove ${num}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/vehicles/${id}`);
          setVehicles(prev => prev.filter(v => v.id !== id));
        } catch (e: any) {
          Alert.error('Error', e.response?.data?.error || 'Failed', 4000);
        }
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <ModuleHeader
        title={t('myVehicles')}
        rightAction={!isLocked ? (
          <ModuleHeaderIconButton icon="add" onPress={openAdd} size={24} />
        ) : undefined}
      />

      {isLocked ? (
        <View style={styles.lockedContainer}>
          <View style={styles.lockedIconBox}>
            <Ionicons name="lock-closed" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.lockedTitle}>Subscription Required</Text>
          <Text style={styles.lockedDesc}>
            Subscribe to register and manage your vehicles in the society.
          </Text>
          <TouchableOpacity style={styles.lockedBtn} onPress={() => router.push('/subscribe' as any)}>
            <Ionicons name="star-outline" size={18} color={Colors.white} />
            <Text style={styles.lockedBtnText}>View Plans</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={styles.emptyTitle}>No vehicles added</Text>
              <Text style={styles.emptyText}>Tap + to register your vehicle</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.75}>
              <Text style={styles.vehicleIcon}>{TYPE_ICON[item.vehicle_type] || '🚗'}</Text>
              <View style={styles.cardInfo}>
                <Text style={styles.vehicleNum}>{item.vehicle_number}</Text>
                <Text style={styles.vehicleType}>{TYPE_LABEL[item.vehicle_type] || item.vehicle_type}</Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteVehicle(item.id, item.vehicle_number)}
                style={styles.deleteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      <BottomSheetModal
        visible={sheetOpen}
        onClose={closeSheet}
        title={editing ? 'Edit Vehicle' : t('addVehicle')}
        snapPoints={['58%', '90%']}
      >
        <Text style={styles.label}>Vehicle Number *</Text>
        <BottomSheetTextInput
          style={styles.input}
          value={form.vehicle_number}
          onChangeText={v => setForm({ ...form, vehicle_number: v.toUpperCase() })}
          placeholder="e.g. GJ01AB1234"
          autoCapitalize="characters"
          placeholderTextColor={Colors.textMuted}
        />
        <Text style={styles.label}>Type *</Text>
        <View style={styles.typeRow}>
          {(['two_wheeler', 'four_wheeler'] as const).map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.typeBtn, form.vehicle_type === type && styles.typeBtnActive]}
              onPress={() => setForm({ ...form, vehicle_type: type })}
            >
              <Text style={styles.typeIcon}>{TYPE_ICON[type]}</Text>
              <Text style={[styles.typeLabel, form.vehicle_type === type && { color: Colors.white }]}>
                {TYPE_LABEL[type]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={saveVehicle} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>{editing ? t('saveChanges') : t('addVehicle')}</Text>}
        </TouchableOpacity>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  list: { padding: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  vehicleIcon: { fontSize: 32 },
  cardInfo: { flex: 1 },
  vehicleNum: { fontSize: 18, fontWeight: '800', color: Colors.text, letterSpacing: 1 },
  vehicleType: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  deleteBtn: { padding: 8 },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 16, color: Colors.text, backgroundColor: Colors.bg, letterSpacing: 1 },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14 },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeIcon: { fontSize: 22 },
  typeLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 24, marginBottom: 8 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  lockedContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 16,
  },
  lockedIconBox: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  lockedTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  lockedDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  lockedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14, marginTop: 8,
  },
  lockedBtnText: { fontSize: 15, fontWeight: '800', color: Colors.white },
});
