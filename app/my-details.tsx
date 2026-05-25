import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, FlatList,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { SkeletonLoader } from '../components/SkeletonLoader';

type DetailField = 'phone' | 'flat_no' | 'wing' | 'total_members';
type Details = Record<DetailField, string>;

const PHONE_RE = /^[6-9]\d{9}$/;
const FLAT_RE = /^[A-Za-z0-9\-\/]+$/;

const stripPhone = (v: string) => v.replace(/\D/g, '').slice(0, 10);
const formatPhone = (v: string) => {
  const d = stripPhone(v);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
};

function validateField(field: DetailField, details: Details): string | null {
  const v = details[field].trim();
  switch (field) {
    case 'phone':
      if (!v) return 'Mobile number is required';
      if (!PHONE_RE.test(stripPhone(v))) return 'Please enter a valid 10-digit mobile number';
      return null;
    case 'flat_no':
      if (!v) return 'Flat number is required';
      if (!FLAT_RE.test(v)) return 'Please enter a valid flat number';
      return null;
    case 'wing':
      return v ? null : 'Wing is required';
    case 'total_members':
      if (!v) return 'Total members is required';
      if (isNaN(Number(v)) || Number(v) < 1) return 'Enter a positive number';
      return null;
    default:
      return null;
  }
}

function fieldStatus(field: DetailField, details: Details, showRequired: boolean) {
  const value = details[field].trim();
  const error = validateField(field, details);
  if (error) return { error: showRequired || value ? error : null, ok: false };
  return { error: null, ok: !!value };
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onDone);
  }, [opacity, onDone]);
  return (
    <Animated.View style={[toastStyles.wrap, { opacity }]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
      <Text style={toastStyles.text}>{message}</Text>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 32, left: 24, right: 24, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.success, paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  text: { color: Colors.white, fontSize: 15, fontWeight: '600', flex: 1 },
});

function DetailsSkeleton() {
  return (
    <View style={styles.card}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.row, i < 3 && styles.rowBorder]}>
          <SkeletonLoader width={40} height={40} borderRadius={12} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonLoader width="35%" height={10} borderRadius={4} />
            <SkeletonLoader width="60%" height={18} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

function PickerModal({ visible, title, options, onSelect, onClose }: {
  visible: boolean; title: string; options: string[];
  onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          <View style={pm.header}>
            <Text style={pm.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.text} /></TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(i) => i}
            renderItem={({ item }) => (
              <TouchableOpacity style={pm.item} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={pm.itemText}>{item}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 16, fontWeight: '800', color: Colors.text },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemText: { fontSize: 15, color: Colors.text },
});

export default function MyDetailsScreen() {
  const { user, refreshUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>({
    phone: user?.phone || '',
    flat_no: user?.flat_no || '',
    wing: user?.wing || '',
    total_members: user?.total_members ? String(user.total_members) : '',
  });

  const [buildingWings, setBuildingWings] = useState<string[]>([]);
  const [showWingPicker, setShowWingPicker] = useState(false);
  const phoneRef = useRef<TextInput>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (user?.building_id) fetchBuildingInfo();
  }, [user?.building_id]);

  const fetchBuildingInfo = async () => {
    try {
      const res = await api.get('/buildings/my');
      if (res.data.has_wings && res.data.wings) {
        const wings = res.data.wings.split(',').map((w: string) => w.trim()).filter(Boolean);
        setBuildingWings(wings);
      }
    } catch (e) {
      console.log('Failed to fetch building wings', e);
    }
  };

  useEffect(() => {
    setDetails({
      phone: user?.phone || '',
      flat_no: user?.flat_no || '',
      wing: user?.wing || '',
      total_members: user?.total_members ? String(user.total_members) : '',
    });
  }, [user]);

  useEffect(() => {
    if (editing && !wasEditing.current) {
      setTimeout(() => phoneRef.current?.focus(), 80);
    }
    if (!editing) setAttemptedSave(false);
    wasEditing.current = editing;
  }, [editing]);

  useEffect(() => {
    if (!user?.phone && !editing) setEditing(true);
  }, [user?.phone]);

  const cancelEdit = () => {
    setEditing(false);
    setDetails({
      phone: user?.phone || '',
      flat_no: user?.flat_no || '',
      wing: user?.wing || '',
      total_members: user?.total_members ? String(user.total_members) : '',
    });
  };

  const updateField = useCallback((field: DetailField, value: string) => {
    setDetails((d) => ({
      ...d,
      [field]: field === 'phone' ? stripPhone(value) : value,
    }));
  }, []);

  const saveDetails = async () => {
    setAttemptedSave(true);
    const fields: DetailField[] = ['phone', 'flat_no', 'wing', 'total_members'];
    if (fields.some((f) => validateField(f, details))) return;

    const payload = {
      phone: stripPhone(details.phone),
      flat_no: details.flat_no.trim(),
      wing: details.wing.trim(),
      total_members: details.total_members.trim(),
    };

    setSaving(true);
    try {
      await api.patch('/auth/profile', payload);
      await refreshUser();
      setEditing(false);
      setToastMsg('Your details have been updated');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    { icon: 'call-outline', label: 'Mobile No.', field: 'phone' as const, placeholder: 'e.g. 90161 14560', keyboardType: 'phone-pad' as const },
    { icon: 'home-outline', label: 'Flat No.', field: 'flat_no' as const, placeholder: 'e.g. 912', keyboardType: 'default' as const },
    { icon: 'people-outline', label: 'Total Members', field: 'total_members' as const, placeholder: 'e.g. 4', keyboardType: 'numeric' as const },
    { icon: 'layers-outline', label: 'Wing', field: 'wing' as const, placeholder: 'e.g. B', keyboardType: 'default' as const },
  ];

  const displayValue = (field: DetailField) => {
    const v = details[field];
    if (!v) return null;
    return field === 'phone' ? formatPhone(v) : v;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" scrollEnabled={!saving}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('myDetails')}</Text>
          {!editing ? (
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
              <Ionicons name="pencil" size={18} color={Colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        {authLoading ? (
          <DetailsSkeleton />
        ) : (
          <View style={styles.card}>
            {!user?.phone && !editing && (
              <View style={styles.missingBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
                <Text style={styles.missingText}>Mobile number not set. Tap Edit to add it.</Text>
              </View>
            )}
            {rows.map((row, idx) => {
              const value = details[row.field];
              const isEmpty = !value.trim();
              const { error, ok } = fieldStatus(row.field, details, attemptedSave);
              const showFeedback = editing && (value.trim() || attemptedSave);

              return (
                <View
                  key={row.field}
                  style={[
                    styles.row,
                    idx < rows.length - 1 && styles.rowBorder,
                    !editing && isEmpty && styles.rowIncomplete,
                  ]}
                >
                  <View style={styles.iconBox}>
                    <Ionicons name={row.icon as any} size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>
                      {row.label}{editing ? <Text style={{ color: Colors.danger }}> *</Text> : null}
                    </Text>
                    {editing ? (
                      row.field === 'wing' && buildingWings.length > 0 ? (
                        <>
                          <TouchableOpacity
                            style={[styles.pickerTrigger, error && styles.inputError, ok && styles.inputOk]}
                            onPress={() => !saving && setShowWingPicker(true)}
                            disabled={saving}
                          >
                            <Text style={[styles.pickerValue, isEmpty && { color: Colors.textMuted }]}>
                              {details.wing || 'Select Wing'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color={Colors.primary} />
                          </TouchableOpacity>
                          {error ? <Text style={styles.errorText}>{error}</Text> : null}
                        </>
                      ) : (
                        <>
                          <View style={styles.inputRow}>
                            <TextInput
                              ref={row.field === 'phone' ? phoneRef : undefined}
                              style={[styles.input, error && styles.inputError, ok && styles.inputOk]}
                              value={row.field === 'phone' ? formatPhone(value) : value}
                              onChangeText={(v) => updateField(row.field, v)}
                              placeholder={row.placeholder}
                              placeholderTextColor={Colors.textMuted}
                              keyboardType={row.keyboardType}
                              maxLength={row.field === 'phone' ? 11 : undefined}
                              editable={!saving}
                            />
                            {showFeedback && (
                              <Ionicons
                                name={ok ? 'checkmark-circle' : 'close-circle'}
                                size={18}
                                color={ok ? Colors.success : Colors.danger}
                              />
                            )}
                          </View>
                          {error ? <Text style={styles.errorText}>{error}</Text> : null}
                        </>
                      )
                    ) : (
                      <View style={styles.valueRow}>
                        {isEmpty ? (
                          <>
                            <View style={styles.warningDot} />
                            <Text style={styles.empty}>Not set</Text>
                          </>
                        ) : (
                          <Text style={styles.value}>{displayValue(row.field)}</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {editing && !authLoading && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={saving}>
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={saveDetails} disabled={saving}>
              <Text style={styles.saveText}>{t('saveChanges')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <PickerModal
          visible={showWingPicker}
          title="Select Wing"
          options={buildingWings}
          onSelect={(v) => updateField('wing', v)}
          onClose={() => setShowWingPicker(false)}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      {saving && (
        <View style={styles.saveOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.saveOverlayText}>Saving…</Text>
        </View>
      )}

      {toastMsg && <Toast message={toastMsg} onDone={() => setToastMsg(null)} />}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 52, paddingBottom: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  editBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  card: { margin: 16, backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIncomplete: { borderLeftWidth: 3, borderLeftColor: Colors.warning, backgroundColor: Colors.warning + '0D' },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  value: { fontSize: 16, fontWeight: '600', color: Colors.text },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { fontSize: 15, color: Colors.warning, fontStyle: 'italic', fontWeight: '500' },
  warningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, fontSize: 16, color: Colors.text, borderBottomWidth: 1.5, borderBottomColor: Colors.primary, paddingVertical: 2 },
  inputError: { borderBottomColor: Colors.danger },
  inputOk: { borderBottomColor: Colors.success },
  errorText: { fontSize: 12, color: Colors.danger, marginTop: 4, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 8 },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
  saveBtn: { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.primary },
  saveBtnDisabled: { opacity: 0.7 },
  saveText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  missingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warning + '15', padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  missingText: { fontSize: 13, color: Colors.warning, fontWeight: '600', flex: 1 },
  pickerTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: Colors.primary, paddingVertical: 4 },
  pickerValue: { fontSize: 16, color: Colors.text, fontWeight: '600' },
  saveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center', alignItems: 'center', zIndex: 50, gap: 12,
  },
  saveOverlayText: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
});
