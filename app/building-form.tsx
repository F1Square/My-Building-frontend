import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import api from '../utils/api';
import { Alert } from '../utils/alert';
import PaymentTermsModal, { type PaymentTermsData } from '../components/PaymentTermsModal';
import { ModuleHeader } from '../components/ModuleHeader';
import { fetchPaymentTerms } from '../utils/paymentTermsCache';
import {
  PAYMENT_OPTIONS,
  defaultBuildingForm,
  buildingToForm,
  type BuildingFormState,
} from '../utils/buildingFormHelpers';

export default function BuildingFormScreen() {
  const router = useRouter();
  const { building_id } = useLocalSearchParams<{ building_id?: string }>();
  const isEdit = !!building_id?.trim();

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [buildingName, setBuildingName] = useState('');
  const [bForm, setBForm] = useState<BuildingFormState>(defaultBuildingForm);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermsData | null>(null);
  const [termsLoading, setTermsLoading] = useState(false);

  const onlineSelected = bForm.payment_methods.includes('Online');
  const requiresTerms = onlineSelected && !termsAccepted;

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get('/buildings/my', { params: { building_id } });
        if (cancelled) return;
        setBuildingName(r.data.name || '');
        setBForm(buildingToForm(r.data));
        setTermsAccepted(!!r.data.payment_tc);
      } catch (e: any) {
        Alert.error('Error', e.response?.data?.error || 'Failed to load building', 4000);
        router.back();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [building_id, isEdit, router]);

  const togglePaymentMethod = (method: string) => {
    setBForm((prev) => {
      const isSelected = prev.payment_methods.includes(method);
      const newMethods = isSelected
        ? prev.payment_methods.filter((x) => x !== method)
        : [...prev.payment_methods, method];
      if (!newMethods.includes('Online')) setTermsAccepted(false);
      return { ...prev, payment_methods: newMethods.length ? newMethods : [method] };
    });
  };

  const openTerms = useCallback(async () => {
    setShowTermsModal(true);
    if (paymentTerms) return;
    setTermsLoading(true);
    try {
      setPaymentTerms(await fetchPaymentTerms());
    } catch {
      Alert.error('Error', 'Failed to load payment terms', 4000);
      setShowTermsModal(false);
    } finally {
      setTermsLoading(false);
    }
  }, [paymentTerms]);

  const handleAcceptTerms = () => {
    setTermsAccepted(true);
    setShowTermsModal(false);
  };

  const saveBuilding = async () => {
    if (!bForm.name.trim()) return Alert.error('Error', 'Building name is required', 4000);
    if (onlineSelected && !termsAccepted) {
      openTerms();
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: bForm.name.trim(),
        address: bForm.address.trim(),
        has_wings: bForm.has_wings,
        wings: bForm.has_wings ? bForm.wings.trim() : null,
        late_fees_enabled: bForm.late_fees_enabled,
        late_fees_amount: bForm.late_fees_amount,
        water_reading_enabled: bForm.water_reading_enabled,
        payment_methods: bForm.payment_methods,
        terms_accepted: onlineSelected ? termsAccepted : false,
      };

      if (isEdit) {
        await api.put(`/buildings/${building_id}`, payload);
        Alert.success('Done', 'Building updated', 4000);
      } else {
        await api.post('/buildings/create', payload);
        Alert.success('Done', 'Building created', 4000);
      }
      router.back();
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed', 4000);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ModuleHeader
        title={isEdit ? `Edit — ${buildingName || 'Building'}` : 'New Building'}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Building Name *</Text>
        <TextInput
          style={styles.input}
          value={bForm.name}
          onChangeText={(v) => setBForm({ ...bForm, name: v })}
          placeholder="e.g. Shree Residency"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={bForm.address}
          onChangeText={(v) => setBForm({ ...bForm, address: v })}
          placeholder="e.g. 12, MG Road, Ahmedabad"
          placeholderTextColor={Colors.textMuted}
        />

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
          <>
            <Text style={styles.label}>Wings (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={bForm.wings}
              onChangeText={(v) => setBForm({ ...bForm, wings: v })}
              placeholder="e.g. A, B, C"
              placeholderTextColor={Colors.textMuted}
            />
          </>
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
          <>
            <Text style={styles.label}>Late Fee Amount (₹)</Text>
            <TextInput
              style={styles.input}
              value={bForm.late_fees_amount}
              onChangeText={(v) => setBForm({ ...bForm, late_fees_amount: v })}
              placeholder="e.g. 100"
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
            />
          </>
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
          {PAYMENT_OPTIONS.map((m) => {
            const isSelected = bForm.payment_methods.includes(m);
            return (
              <TouchableOpacity key={m} style={styles.checkboxRow} onPress={() => togglePaymentMethod(m)}>
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
                </View>
                <Text style={styles.checkboxText}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {onlineSelected && (
          <View style={styles.termsContainer}>
            <View style={styles.termsCheckboxRow}>
              <TouchableOpacity
                onPress={() => (termsAccepted ? setTermsAccepted(false) : openTerms())}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                  {termsAccepted && <Ionicons name="checkmark" size={14} color={Colors.white} />}
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.termsText}>
                  I accept the{' '}
                  <Text style={styles.termsLink} onPress={openTerms}>
                    Payment Terms & Conditions
                  </Text>
                </Text>
                <Text style={styles.termsSubText}>Required for online payment gateway (Easebuzz)</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.termsReadLink} onPress={openTerms}>
              <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
              <Text style={styles.termsReadLinkText}>Read full Easebuzz terms & conditions</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>

            <Text style={styles.termsNote}>
              App ownership: M & A Technology · Payments go directly to society account · No intermediaries
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, requiresTerms && styles.submitBtnDisabled]}
          onPress={saveBuilding}
          disabled={submitting || requiresTerms}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>{isEdit ? 'Save Changes' : 'Create Building'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <PaymentTermsModal
        visible={showTermsModal}
        terms={paymentTerms}
        loading={termsLoading}
        onClose={() => setShowTermsModal(false)}
        onAccept={handleAcceptTerms}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  header: {
    backgroundColor: '#3B5FC0',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, color: Colors.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  switchSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  switch: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E5E7EB', padding: 2 },
  switchOn: { backgroundColor: Colors.primary },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.white },
  switchThumbOn: { alignSelf: 'flex-end' },
  checkboxGroup: { flexDirection: 'row', gap: 16, marginTop: 4, flexWrap: 'wrap' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxText: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  termsContainer: {
    marginTop: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  termsCheckboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  termsText: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  termsLink: { color: Colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
  termsSubText: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  termsReadLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 8 },
  termsReadLinkText: { flex: 1, fontSize: 13, color: Colors.primary, fontWeight: '600' },
  termsNote: { fontSize: 11, color: Colors.textMuted, marginTop: 8, lineHeight: 16, fontStyle: 'italic' },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
