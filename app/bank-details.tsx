import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
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
    bank_branch: '', 
    bank_ifsc: '', 
    bank_account: '', 
    beneficiary_name: '', 
    contact_name: '', 
    contact_email: '', 
    contact_mobile: '',
    business_type: 'society',
    profile_category: 'others',
    profile_subcategory: 'others',
    address: '',
    address2: '',
    city: '',
    state: '',
    pincode: ''
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkedAccount, setLinkedAccount] = useState<{ linked: boolean; account_id?: string; account?: any } | null>(null);

  const activeBuildingId = isAdmin ? selectedBuilding?.id : user?.building_id;

  useEffect(() => {
    if (activeBuildingId) fetchDetails();
    else setDetails({ 
      bank_name: '', 
      bank_branch: '', 
      bank_ifsc: '', 
      bank_account: '', 
      beneficiary_name: '', 
      contact_name: '', 
      contact_email: '', 
      contact_mobile: '',
      business_type: 'society',
      profile_category: 'others',
      profile_subcategory: 'others',
      address: '',
      address2: '',
      city: '',
      state: '',
      pincode: ''
    });
  }, [activeBuildingId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const params = isAdmin ? { building_id: activeBuildingId } : {};
      const res = await api.get('/buildings/bank-details', { params });
      setDetails({
        bank_name: res.data.bank_name || '',
        bank_branch: res.data.bank_branch || '',
        bank_ifsc: res.data.bank_ifsc || '',
        bank_account: res.data.bank_account || '',
        beneficiary_name: res.data.beneficiary_name || '',
        contact_name: res.data.contact_name || '',
        contact_email: res.data.contact_email || '',
        contact_mobile: res.data.contact_mobile || '',
        business_type: res.data.business_type || 'society',
        profile_category: res.data.profile_category || 'others',
        profile_subcategory: res.data.profile_subcategory || 'others',
        address: res.data.address || '',
        address2: res.data.address2 || '',
        city: res.data.city || '',
        state: res.data.state || '',
        pincode: res.data.pincode || ''
      });
      // Also fetch linked account status
      try {
        const la = await api.get('/routes/linked-account', { params });
        setLinkedAccount(la.data);
      } catch { setLinkedAccount(null); }
    } catch {}
    finally { setLoading(false); }
  };

  const save = async () => {
    if (isAdmin && !selectedBuilding) return Alert.alert('Error', 'Please select a building first');
    if (!details.bank_account || !details.bank_ifsc) return Alert.alert('Error', 'Account number and IFSC are required');
    if (!details.beneficiary_name) return Alert.alert('Error', 'Beneficiary name is required');
    if (!details.contact_name || details.contact_name.length < 4) return Alert.alert('Error', 'Contact person name is required (min 4 characters)');
    if (!details.contact_email) return Alert.alert('Error', 'Contact email is required');
    if (!details.contact_mobile || details.contact_mobile.length < 10) return Alert.alert('Error', 'Valid 10-digit contact mobile is required');
    if (!details.address || !details.address2 || !details.city || !details.state || !details.pincode) return Alert.alert('Error', 'Complete address (street 1, street 2, city, state, pincode) is required for Razorpay registration');
    setSaving(true);
    try {
      const payload: any = { ...details };
      if (isAdmin) payload.building_id = selectedBuilding!.id;
      // 1. Save bank details to DB
      await api.post('/buildings/bank-details', payload);

      // 2. Auto-setup Razorpay Routes linked account if not already linked
      if (!linkedAccount?.linked) {
        const buildingId = isAdmin ? selectedBuilding!.id : user?.building_id;
        const societyName = isAdmin ? selectedBuilding!.name : (details.beneficiary_name || 'Society');
        try {
          await api.post('/routes/linked-account', {
            building_id: buildingId,
            legal_business_name: societyName,
            business_type: details.business_type || 'society',
            contact_name: details.contact_name,
            contact_email: details.contact_email,
            contact_mobile: details.contact_mobile,
            profile_category: details.profile_category || 'others',
            profile_subcategory: details.profile_subcategory || 'others',
            address: details.address,
            address2: details.address2,
            city: details.city,
            state: details.state,
            pincode: details.pincode,
          });
          // 3. Link the bank account to the Razorpay linked account
          await api.post('/routes/bank-account', {
            building_id: buildingId,
            account_number: details.bank_account,
            ifsc: details.bank_ifsc,
            beneficiary_name: details.beneficiary_name || societyName,
          });
          // Refresh linked account status
          const params = isAdmin ? { building_id: buildingId } : {};
          const la = await api.get('/routes/linked-account', { params });
          setLinkedAccount(la.data);
        } catch (routeErr: any) {
          // Routes not enabled yet — save bank details anyway, show info
          console.log('[Routes] Not enabled yet:', routeErr.response?.data?.error);
        }
      }

      setEditing(false);
      Alert.alert('Saved', 'Bank details saved successfully');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
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

          {/* Razorpay Routes status */}
          {linkedAccount !== null && (
            <View style={[styles.routesBadge, { backgroundColor: linkedAccount.linked ? Colors.success + '15' : Colors.warning + '15' }]}>
              <Ionicons
                name={linkedAccount.linked ? 'checkmark-circle' : 'alert-circle-outline'}
                size={16}
                color={linkedAccount.linked ? Colors.success : Colors.warning}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.routesBadgeTitle, { color: linkedAccount.linked ? Colors.success : Colors.warning }]}>
                  {linkedAccount.linked ? 'Razorpay Routes: Linked ✓' : 'Razorpay Routes: Not linked'}
                </Text>
                <Text style={styles.routesBadgeSub}>
                  {linkedAccount.linked
                    ? `Account ID: ${linkedAccount.account_id}`
                    : 'Save bank details to auto-link for direct transfers'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.card}>
            {editing ? (
              <View>
                <Text style={styles.sectionLabel}>Bank Details</Text>
                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput style={styles.input} value={details.bank_name} onChangeText={(v) => setDetails({ ...details, bank_name: v })} placeholder="e.g. State Bank of India" placeholderTextColor={Colors.textMuted} />
                <Text style={styles.inputLabel}>Branch</Text>
                <TextInput style={styles.input} value={details.bank_branch} onChangeText={(v) => setDetails({ ...details, bank_branch: v })} placeholder="e.g. Andheri West" placeholderTextColor={Colors.textMuted} />
                <Text style={styles.inputLabel}>IFSC Code *</Text>
                <TextInput style={styles.input} value={details.bank_ifsc} onChangeText={(v) => setDetails({ ...details, bank_ifsc: v.toUpperCase() })} placeholder="e.g. SBIN0001234" placeholderTextColor={Colors.textMuted} autoCapitalize="characters" />
                <Text style={styles.inputLabel}>Account Number *</Text>
                <TextInput style={styles.input} value={details.bank_account} onChangeText={(v) => setDetails({ ...details, bank_account: v })} placeholder="e.g. 1234567890" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
                <Text style={styles.inputLabel}>Beneficiary Name *</Text>
                <TextInput style={styles.input} value={details.beneficiary_name} onChangeText={(v) => setDetails({ ...details, beneficiary_name: v })} placeholder="e.g. Shree Residency Society" placeholderTextColor={Colors.textMuted} />

                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Razorpay Routes Registration Details</Text>
                <Text style={styles.sectionSub}>All fields required to enable direct transfers to society account</Text>
                
                <Text style={styles.inputLabel}>Business Category *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={details.profile_category}
                    onValueChange={(v) => {
                      const subcategory = v === 'healthcare' ? 'clinic' : v === 'education' ? 'school' : v === 'financial_services' ? 'accounting' : 'others';
                      setDetails({ ...details, profile_category: v, profile_subcategory: subcategory });
                    }}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label="Others" value="others" />
                    <Picker.Item label="Healthcare" value="healthcare" />
                    <Picker.Item label="Education" value="education" />
                    <Picker.Item label="Financial Services" value="financial_services" />
                    <Picker.Item label="Food & Beverage" value="food" />
                    <Picker.Item label="Utilities" value="utilities" />
                    <Picker.Item label="Government" value="government" />
                    <Picker.Item label="Logistics" value="logistics" />
                    <Picker.Item label="Tours & Travel" value="tours_and_travel" />
                    <Picker.Item label="Transport" value="transport" />
                    <Picker.Item label="Ecommerce" value="ecommerce" />
                    <Picker.Item label="Services" value="services" />
                    <Picker.Item label="Housing" value="housing" />
                    <Picker.Item label="Not For Profit" value="not_for_profit" />
                  </Picker>
                </View>
                
                <Text style={styles.inputLabel}>Business Type *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={details.business_type}
                    onValueChange={(v) => setDetails({ ...details, business_type: v })}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label="Society" value="society" />
                    <Picker.Item label="Trust" value="trust" />
                    <Picker.Item label="NGO" value="ngo" />
                    <Picker.Item label="Partnership" value="partnership" />
                    <Picker.Item label="Proprietorship" value="proprietorship" />
                    <Picker.Item label="Private Limited" value="private_limited" />
                    <Picker.Item label="Public Limited" value="public_limited" />
                    <Picker.Item label="LLP" value="llp" />
                    <Picker.Item label="Individual" value="individual" />
                  </Picker>
                </View>
                
                <Text style={styles.inputLabel}>Contact Person Name * (min 4 chars)</Text>
                <TextInput style={styles.input} value={details.contact_name} onChangeText={(v) => setDetails({ ...details, contact_name: v })} placeholder="e.g. Ramesh Patel (Pramukh)" placeholderTextColor={Colors.textMuted} />
                
                <Text style={styles.inputLabel}>Contact Email *</Text>
                <TextInput style={styles.input} value={details.contact_email} onChangeText={(v) => setDetails({ ...details, contact_email: v })} placeholder="e.g. pramukh@society.com" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
                
                <Text style={styles.inputLabel}>Contact Mobile * (10 digits)</Text>
                <TextInput style={styles.input} value={details.contact_mobile} onChangeText={(v) => setDetails({ ...details, contact_mobile: v })} placeholder="e.g. 9876543210" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" maxLength={10} />
                
                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Society Address</Text>
                <Text style={styles.sectionSub}>Complete registered address required by Razorpay</Text>
                
                <Text style={styles.inputLabel}>Street Address Line 1 *</Text>
                <TextInput style={styles.input} value={details.address} onChangeText={(v) => setDetails({ ...details, address: v })} placeholder="e.g. Building Name, Flat/Wing No" placeholderTextColor={Colors.textMuted} />
                
                <Text style={styles.inputLabel}>Street Address Line 2 *</Text>
                <TextInput style={styles.input} value={details.address2} onChangeText={(v) => setDetails({ ...details, address2: v })} placeholder="e.g. Area, Landmark, Road Name" placeholderTextColor={Colors.textMuted} />
                
                <Text style={styles.inputLabel}>City *</Text>
                <TextInput style={styles.input} value={details.city} onChangeText={(v) => setDetails({ ...details, city: v })} placeholder="e.g. Mumbai" placeholderTextColor={Colors.textMuted} />
                
                <Text style={styles.inputLabel}>State *</Text>
                <TextInput style={styles.input} value={details.state} onChangeText={(v) => setDetails({ ...details, state: v })} placeholder="e.g. Maharashtra" placeholderTextColor={Colors.textMuted} />
                
                <Text style={styles.inputLabel}>Pincode *</Text>
                <TextInput style={styles.input} value={details.pincode} onChangeText={(v) => setDetails({ ...details, pincode: v })} placeholder="e.g. 400001" placeholderTextColor={Colors.textMuted} keyboardType="numeric" maxLength={6} />

                <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={styles.saveBtnText}>Save & Link to Razorpay</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Row icon="business-outline" label="Bank Name" value={details.bank_name} />
                <Row icon="location-outline" label="Branch" value={details.bank_branch} />
                <Row icon="barcode-outline" label="IFSC Code" value={details.bank_ifsc} mono />
                <Row icon="card-outline" label="Account Number" value={details.bank_account} mono />
                {details.beneficiary_name ? <Row icon="person-outline" label="Beneficiary Name" value={details.beneficiary_name} /> : null}
                {details.contact_name ? <Row icon="call-outline" label="Contact Person" value={details.contact_name} /> : null}
              </View>
            )}
          </View>

          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.hintText}>
              All fields marked with * are mandatory for Razorpay Route registration. Once saved, the system will automatically create a linked account to enable direct transfers of maintenance payments to your society's bank account.
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
  pickerContainer: { 
    borderWidth: 1.5, 
    borderColor: Colors.border, 
    borderRadius: 10, 
    backgroundColor: Colors.white, 
    overflow: 'hidden',
    minHeight: 50,
    justifyContent: 'center',
  },
  picker: { 
    fontSize: 15, 
    color: '#000000',
    backgroundColor: Colors.white,
    height: 50,
    paddingHorizontal: 12,
  },
  pickerItem: {
    fontSize: 15,
    color: '#000000',
    backgroundColor: Colors.white,
    height: 50,
  },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, padding: 12, backgroundColor: Colors.white, borderRadius: 12 },
  hintText: { flex: 1, fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  routesBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 14, marginBottom: 12 },
  routesBadgeTitle: { fontSize: 13, fontWeight: '700' },
  routesBadgeSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  sectionSub: { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
});
