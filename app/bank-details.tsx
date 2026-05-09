import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import BuildingDropdown from '../components/BuildingDropdown';
import { useBuildings, Building } from '../hooks/useBuildings';

function Row({ icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, mono ? { fontFamily: 'monospace' } : {}]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export default function BankDetailsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';

  // Hard guard — only admin can access this screen
  useEffect(() => {
    if (user && !isAdmin) {
      router.replace('/' as any);
    }
  }, [user, isAdmin]);

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  const [details, setDetails] = useState({ 
    bank_name: '', 
    bank_account: '', 
    bank_ifsc: '', 
    beneficiary_name: '',
    razorpay_account_id: ''
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeBuildingId = isAdmin ? selectedBuilding?.id : user?.building_id;

  useEffect(() => {
    if (activeBuildingId) fetchDetails();
    else setDetails({ 
      bank_name: '', 
      bank_account: '', 
      bank_ifsc: '', 
      beneficiary_name: '',
      razorpay_account_id: ''
    });
  }, [activeBuildingId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const params = isAdmin ? { building_id: activeBuildingId } : {};
      const res = await api.get('/buildings/bank-details', { params });
      setDetails({
        bank_name: res.data.bank_name || '',
        bank_account: res.data.bank_account || '',
        bank_ifsc: res.data.bank_ifsc || '',
        beneficiary_name: res.data.beneficiary_name || '',
        razorpay_account_id: res.data.razorpay_account_id || ''
      });
    } catch {}
    finally { setLoading(false); }
  };

  const save = async () => {
    if (isAdmin && !selectedBuilding) return Alert.alert('Error', 'Please select a building first');
    if (!details.bank_account || !details.bank_ifsc) return Alert.alert('Error', 'Account number and IFSC are required');
    if (!details.beneficiary_name) return Alert.alert('Error', 'Beneficiary name is required');
    
    setSaving(true);
    try {
      const payload: any = { ...details };
      if (isAdmin) payload.building_id = selectedBuilding!.id;
      
      await api.post('/buildings/bank-details', payload);
      setEditing(false);
      Alert.alert('Saved', 'Bank details saved successfully');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openEasebuzzDashboard = () => {
    Linking.openURL('https://testpay.easebuzz.in/');
  };

  

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('bankDetails')}</Text>
        {activeBuildingId ? (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(!editing)}>
            <Ionicons name={editing ? 'close' : 'create-outline'} size={20} color={Colors.white} />
            <Text style={styles.editBtnText}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editBtn} />
        )}
      </View>

      {/* Fixed Admin building selector */}
      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown
            buildings={buildings}
            loading={buildingsLoading}
            selected={selectedBuilding}
            onSelect={(b) => { setSelectedBuilding(b); setEditing(false); }}
            label="Select Society / Building"
          />
        </View>
      )}

      {/* Scrollable Content */}
      {isAdmin && !selectedBuilding ? (
        <View style={styles.emptyBox}>
          <Ionicons name="business-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyText}>Select a society to view or edit bank details</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <ScrollView 
          style={styles.scrollContent}
          contentContainerStyle={{ padding: 16 }} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isAdmin && selectedBuilding && (
            <View style={styles.buildingBadge}>
              <Ionicons name="business" size={15} color={Colors.primary} />
              <Text style={styles.buildingBadgeText}>{selectedBuilding.name}</Text>
            </View>
          )}

          {/* Easebuzz Merchant Status */}
          {details.razorpay_account_id ? (
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <Text style={styles.statusTitle}>Easebuzz Merchant Connected</Text>
              </View>
              <Text style={styles.accountId}>Merchant ID: {details.razorpay_account_id}</Text>
              <TouchableOpacity style={styles.dashboardBtn} onPress={openEasebuzzDashboard}>
                <Ionicons name="open-outline" size={16} color={Colors.primary} />
                <Text style={styles.dashboardBtnText}>Open Easebuzz Dashboard</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Ionicons name="alert-circle-outline" size={20} color={Colors.warning} />
                <Text style={[styles.statusTitle, { color: Colors.warning }]}>No Easebuzz Merchant</Text>
              </View>
              <Text style={styles.statusDesc}>
                Add Easebuzz merchant/sub-merchant ID below to enable direct collection.
              </Text>
              <TouchableOpacity style={styles.dashboardBtn} onPress={openEasebuzzDashboard}>
                <Ionicons name="open-outline" size={16} color={Colors.primary} />
                <Text style={styles.dashboardBtnText}>Open Easebuzz Portal</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.card}>
            {editing ? (
              <View>
                <Text style={styles.sectionLabel}>Bank Account Details</Text>
                
                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput 
                  style={styles.input} 
                  value={details.bank_name} 
                  onChangeText={(v) => setDetails({ ...details, bank_name: v })} 
                  placeholder="e.g. State Bank of India" 
                  placeholderTextColor={Colors.textMuted} 
                />
                
                <Text style={styles.inputLabel}>Account Number *</Text>
                <TextInput 
                  style={styles.input} 
                  value={details.bank_account} 
                  onChangeText={(v) => setDetails({ ...details, bank_account: v })} 
                  placeholder="e.g. 1234567890" 
                  placeholderTextColor={Colors.textMuted} 
                  keyboardType="numeric" 
                />
                
                <Text style={styles.inputLabel}>IFSC Code *</Text>
                <TextInput 
                  style={styles.input} 
                  value={details.bank_ifsc} 
                  onChangeText={(v) => setDetails({ ...details, bank_ifsc: v.toUpperCase() })} 
                  placeholder="e.g. SBIN0001234" 
                  placeholderTextColor={Colors.textMuted} 
                  autoCapitalize="characters" 
                />
                
                <Text style={styles.inputLabel}>Beneficiary Name *</Text>
                <TextInput 
                  style={styles.input} 
                  value={details.beneficiary_name} 
                  onChangeText={(v) => setDetails({ ...details, beneficiary_name: v })} 
                  placeholder="e.g. Shree Residency Society" 
                  placeholderTextColor={Colors.textMuted} 
                />

                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Easebuzz Integration</Text>
                <Text style={styles.sectionSub}>Submit your Easebuzz Merchant ID to enable payment collection</Text>
                
                <Text style={styles.inputLabel}>Easebuzz Merchant ID</Text>
                <TextInput 
                  style={styles.input} 
                  value={details.razorpay_account_id} 
                  onChangeText={(v) => setDetails({ ...details, razorpay_account_id: v })} 
                  placeholder="e.g. SBMxxxxxx / merchant id" 
                  placeholderTextColor={Colors.textMuted} 
                />

                <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={styles.saveBtnText}>Save Bank Details</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Row icon="business-outline" label="Bank Name" value={details.bank_name} />
                <Row icon="card-outline" label="Account Number" value={details.bank_account} mono />
                <Row icon="barcode-outline" label="IFSC Code" value={details.bank_ifsc} mono />
                <Row icon="person-outline" label="Beneficiary Name" value={details.beneficiary_name} />
                {details.razorpay_account_id && (
                  <Row icon="shield-checkmark-outline" label="Easebuzz Merchant ID" value={details.razorpay_account_id} mono />
                )}
              </View>
            )}
          </View>

          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.hintText}>
              Easebuzz Collection Setup: add merchant/sub-merchant ID for society-level collections.
              Maintenance payments are tagged for society settlement, while subscriptions are tagged for admin settlement.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800', flex: 1, textAlign: 'center' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  editBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  scrollContent: { flex: 1 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 15, color: Colors.textMuted, textAlign: 'center' },
  buildingBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary + '12', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, alignSelf: 'flex-start' },
  buildingBadgeText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 12, color: Colors.textMuted },
  rowValue: { fontSize: 15, fontWeight: '600', color: Colors.text, marginTop: 2 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, padding: 12, backgroundColor: Colors.white, borderRadius: 12 },
  hintText: { flex: 1, fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  sectionSub: { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
  statusCard: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusTitle: { fontSize: 15, fontWeight: '700', color: Colors.success },
  statusDesc: { fontSize: 13, color: Colors.textMuted, marginBottom: 12, lineHeight: 18 },
  accountId: { fontSize: 12, fontFamily: 'monospace', color: Colors.text, backgroundColor: Colors.bg, padding: 8, borderRadius: 6, marginBottom: 12 },
  dashboardBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  dashboardBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
});
