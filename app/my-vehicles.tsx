import React, { useState, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import api from '../utils/api';

const VEHICLE_RE = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/;

const TYPE_ICON: Record<string, string> = { two_wheeler: '🛵', four_wheeler: '🚗' };
const TYPE_LABEL: Record<string, string> = { two_wheeler: 'Two Wheeler', four_wheeler: 'Four Wheeler' };

export default function MyVehiclesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ vehicle_number: '', vehicle_type: 'two_wheeler' });
  const [submitting, setSubmitting] = useState(false);

  const fetch = async () => {
    try {
      const res = await api.get('/vehicles/mine');
      setVehicles(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetch(); }, []));

  const addVehicle = async () => {
    const num = form.vehicle_number.toUpperCase().replace(/\s/g, '');
    if (!num) return Alert.alert('Error', 'Vehicle number is required');
    if (!VEHICLE_RE.test(num)) return Alert.alert('Invalid', 'Enter a valid number e.g. GJ05HR4533');
    setSubmitting(true);
    try {
      await api.post('/vehicles', { vehicle_number: num, vehicle_type: form.vehicle_type });
      setShowAdd(false);
      setForm({ vehicle_number: '', vehicle_type: 'two_wheeler' });
      fetch();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to add vehicle');
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
          Alert.alert('Error', e.response?.data?.error || 'Failed');
        }
      }},
    ]);
  };

  

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('myVehicles')}</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
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
            <View style={styles.card}>
              <Text style={styles.vehicleIcon}>{TYPE_ICON[item.vehicle_type] || '🚗'}</Text>
              <View style={styles.cardInfo}>
                <Text style={styles.vehicleNum}>{item.vehicle_number}</Text>
                <Text style={styles.vehicleType}>{TYPE_LABEL[item.vehicle_type] || item.vehicle_type}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteVehicle(item.id, item.vehicle_number)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Add Vehicle Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('addVehicle')}</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Vehicle Number *</Text>
            <TextInput
              style={styles.input}
              value={form.vehicle_number}
              onChangeText={v => setForm({ ...form, vehicle_number: v.toUpperCase() })}
              placeholder="e.g. GJ01AB1234"
              autoCapitalize="characters"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.label}>Type *</Text>
            <View style={styles.typeRow}>
              {['two_wheeler', 'four_wheeler'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, form.vehicle_type === t && styles.typeBtnActive]}
                  onPress={() => setForm({ ...form, vehicle_type: t })}
                >
                  <Text style={styles.typeIcon}>{TYPE_ICON[t]}</Text>
                  <Text style={[styles.typeLabel, form.vehicle_type === t && { color: Colors.white }]}>
                    {TYPE_LABEL[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={addVehicle} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{t('addVehicle')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 16, color: Colors.text, backgroundColor: Colors.bg, letterSpacing: 1 },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14 },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeIcon: { fontSize: 22 },
  typeLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 28, marginBottom: 30 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
