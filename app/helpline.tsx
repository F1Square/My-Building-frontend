import React, { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Keyboard, Platform,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import BuildingDropdown from '../components/BuildingDropdown';
import BottomSheetModal, { BottomSheetTextInput } from '../components/BottomSheetModal';
import HorizontalChipScroll, { chipStyles } from '../components/HorizontalChipScroll';
import { ModuleHeader, ModuleHeaderIconButton } from '../components/ModuleHeader';
import { useBuildings } from '../hooks/useBuildings';
import type { Building } from '../hooks/useBuildings';

const PROFESSION_SUGGESTIONS = [
  'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Security Guard',
  'Lift Technician', 'Pest Control', 'Housekeeping', 'Doctor', 'Ambulance',
  'Fire Station', 'Police', 'Gas Agency', 'Water Supply', 'Other',
];

const PROFESSION_ICONS: Record<string, string> = {
  Plumber: 'water-outline',
  Electrician: 'flash-outline',
  Carpenter: 'hammer-outline',
  Painter: 'color-palette-outline',
  'Security Guard': 'shield-outline',
  'Lift Technician': 'git-commit-outline',
  'Pest Control': 'bug-outline',
  Housekeeping: 'home-outline',
  Doctor: 'medkit-outline',
  Ambulance: 'car-outline',
  'Fire Station': 'flame-outline',
  Police: 'shield-checkmark-outline',
  'Gas Agency': 'flame-outline',
  'Water Supply': 'water-outline',
};

function getProfessionIcon(profession: string): string {
  return PROFESSION_ICONS[profession] || 'call-outline';
}

function getProfessionColor(profession: string): string {
  const colors: Record<string, string> = {
    Plumber: '#0EA5E9', Electrician: '#F59E0B', Carpenter: '#92400E',
    Painter: '#EC4899', 'Security Guard': '#059669', Doctor: '#EF4444',
    Ambulance: '#EF4444', 'Fire Station': '#EF4444', Police: '#1E3A8A',
  };
  return colors[profession] || Colors.primary;
}

const PHONE_RE = /^[6-9]\d{9}$/;

type HelplineForm = { profession: string; name: string; phone: string };
type FormErrors = { profession?: string; name?: string; phone?: string; building?: string; general?: string };

function validateHelplineForm(
  form: HelplineForm,
  options: { requireBuilding: boolean; hasBuilding: boolean },
): FormErrors {
  const errors: FormErrors = {};
  if (!form.profession.trim()) {
    errors.profession = 'Please select a profession';
  }
  if (!form.name.trim()) {
    errors.name = 'Name is required';
  } else if (form.name.trim().length > 100) {
    errors.name = 'Name must not exceed 100 characters';
  }
  if (!form.phone.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!PHONE_RE.test(form.phone.trim())) {
    errors.phone = 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9';
  }
  if (options.requireBuilding && !options.hasBuilding) {
    errors.building = 'Please select a society first';
  }
  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle" size={14} color={Colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/** Profession chips — same horizontal scroller as Help & Support categories. */
function ProfessionChips({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (profession: string) => void;
}) {
  return (
    <HorizontalChipScroll>
      {PROFESSION_SUGGESTIONS.map((item) => {
        const active = selected === item;
        const color = getProfessionColor(item);
        return (
          <TouchableOpacity
            key={item}
            style={[
              chipStyles.chip,
              active && { backgroundColor: color, borderColor: color },
            ]}
            onPress={() => onSelect(item)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={getProfessionIcon(item) as any}
              size={14}
              color={active ? Colors.white : color}
            />
            <Text style={[chipStyles.chipText, active && chipStyles.chipTextOn]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </HorizontalChipScroll>
  );
}

export default function HelplineScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh';
  const canManage = isAdmin || isPramukh;

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  const [helplines, setHelplines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<HelplineForm>({ profession: '', name: '', phone: '' });
  const [addErrors, setAddErrors] = useState<FormErrors>({});
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<HelplineForm>({ profession: '', name: '', phone: '' });
  const [editErrors, setEditErrors] = useState<FormErrors>({});
  const [formKeyboardPad, setFormKeyboardPad] = useState(0);

  const sheetOpen = showAdd || !!editItem;

  // Helpline-only: spacer so the existing sheet body can scroll phone above the IME
  useEffect(() => {
    if (!sheetOpen) {
      setFormKeyboardPad(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const next = Math.round(e.endCoordinates.height);
      setFormKeyboardPad((prev) => (prev === next ? prev : next));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setFormKeyboardPad(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [sheetOpen]);

  const activeBuildingId = isAdmin ? selectedBuilding?.id : user?.building_id;

  const fetchHelplines = async () => {
    if (isAdmin && !selectedBuilding) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const params = isAdmin ? { building_id: activeBuildingId } : {};
      const res = await api.get('/helpline', { params });
      setHelplines(res.data);
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed to load', 4000);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchHelplines(); }, [selectedBuilding]));

  const resetAddForm = () => {
    setForm({ profession: '', name: '', phone: '' });
    setAddErrors({});
  };

  const openAdd = () => {
    resetAddForm();
    setShowAdd(true);
  };

  const clearFieldError = (
    setErrors: React.Dispatch<React.SetStateAction<FormErrors>>,
    field: keyof FormErrors,
  ) => {
    setErrors((prev) => (prev[field] || prev.general
      ? { ...prev, [field]: undefined, general: undefined }
      : prev));
  };

  const addHelpline = async () => {
    const errors = validateHelplineForm(form, {
      requireBuilding: isAdmin,
      hasBuilding: Boolean(selectedBuilding),
    });
    setAddErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setAddErrors({});
    try {
      const payload: Record<string, string> = {
        profession: form.profession.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
      };
      if (isAdmin) payload.building_id = selectedBuilding!.id;
      await api.post('/helpline', payload);
      setShowAdd(false);
      resetAddForm();
      fetchHelplines();
    } catch (e: any) {
      setAddErrors({ general: e.response?.data?.error || 'Failed to add helpline number' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditForm({
      profession: item.profession || '',
      name: item.name || '',
      phone: item.phone || '',
    });
    setEditErrors({});
  };

  const updateHelpline = async () => {
    if (!editItem) return;
    const errors = validateHelplineForm(editForm, { requireBuilding: false, hasBuilding: true });
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setEditErrors({});
    try {
      await api.patch(`/helpline/${editItem.id}`, {
        profession: editForm.profession.trim(),
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
      });
      setEditItem(null);
      fetchHelplines();
    } catch (e: any) {
      setEditErrors({ general: e.response?.data?.error || 'Failed to update' });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteHelpline = (id: string, name: string) => {
    Alert.alert('Delete', `Remove "${name}" from helpline?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/helpline/${id}`);
            fetchHelplines();
          } catch (e: any) {
            Alert.error('Error', e.response?.data?.error || 'Failed to delete', 4000);
          }
        },
      },
    ]);
  };

  const callNumber = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const renderItem = ({ item }: { item: any }) => {
    const color = getProfessionColor(item.profession);
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: color + '18' }]}>
            <Ionicons name={getProfessionIcon(item.profession) as any} size={22} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardProfession}>{item.profession}</Text>
            <Text style={styles.cardPhone}>{item.phone}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.callBtn, { backgroundColor: Colors.success + '15' }]}
            onPress={() => callNumber(item.phone)}
          >
            <Ionicons name="call" size={18} color={Colors.success} />
          </TouchableOpacity>
          {canManage && (
            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: Colors.primary + '15' }]}
              onPress={() => openEdit(item)}
            >
              <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}
          {canManage && (
            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: Colors.danger + '15' }]}
              onPress={() => deleteHelpline(item.id, item.name)}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderHelplineForm = (
    values: HelplineForm,
    errors: FormErrors,
    setErrors: React.Dispatch<React.SetStateAction<FormErrors>>,
    onChange: (patch: Partial<HelplineForm>) => void,
    onSubmit: () => void,
    submitLabel: string,
    showBuildingPicker: boolean,
  ) => (
    <>
      {showBuildingPicker && (
        <>
          <Text style={styles.label}>Society *</Text>
          <View style={[styles.buildingReadonly, !selectedBuilding && styles.inputError]}>
            <Ionicons name="business-outline" size={18} color={Colors.primary} />
            <Text style={[styles.buildingReadonlyText, !selectedBuilding && { color: Colors.textMuted }]}>
              {selectedBuilding?.name || 'Select a society using the dropdown above first'}
            </Text>
          </View>
          <FieldError message={errors.building} />
        </>
      )}

      <Text style={styles.label}>{t('profession')} *</Text>
      <ProfessionChips
        selected={values.profession}
        onSelect={(profession) => {
          onChange({ profession });
          clearFieldError(setErrors, 'profession');
        }}
      />
      <FieldError message={errors.profession} />

      <Text style={styles.label}>Contact Name *</Text>
      <BottomSheetTextInput
        style={[styles.input, errors.name ? styles.inputError : null]}
        value={values.name}
        onChangeText={(name) => {
          onChange({ name });
          clearFieldError(setErrors, 'name');
        }}
        placeholder="e.g. Ramesh Kumar"
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="words"
      />
      <FieldError message={errors.name} />

      <Text style={styles.label}>Phone Number *</Text>
      <BottomSheetTextInput
        style={[styles.input, errors.phone ? styles.inputError : null]}
        value={values.phone}
        onChangeText={(phone) => {
          onChange({ phone });
          clearFieldError(setErrors, 'phone');
        }}
        placeholder="e.g. 9876543210"
        keyboardType="phone-pad"
        maxLength={10}
        placeholderTextColor={Colors.textMuted}
      />
      <FieldError message={errors.phone} />

      {errors.general ? (
        <View style={styles.formErrorBanner}>
          <Ionicons name="alert-circle" size={16} color={Colors.danger} />
          <Text style={styles.errorText}>{errors.general}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={onSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color={Colors.white} />
          : <Text style={styles.submitBtnText}>{submitLabel}</Text>}
      </TouchableOpacity>

      {/* Helpline-only: scroll room inside the sheet when keyboard is open */}
      {formKeyboardPad > 0 ? <View style={{ height: formKeyboardPad }} collapsable={false} /> : null}
    </>
  );

  return (
    <View style={styles.container}>
      <ModuleHeader
        title={t('helplineNumbers')}
        rightAction={canManage ? <ModuleHeaderIconButton icon="add" onPress={openAdd} /> : undefined}
      />

      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown
            buildings={buildings}
            loading={buildingsLoading}
            selected={selectedBuilding}
            onSelect={(b) => { setSelectedBuilding(b); setHelplines([]); setLoading(true); }}
            label="Select Society"
          />
        </View>
      )}

      {isAdmin && !selectedBuilding ? (
        <View style={styles.emptyBox}>
          <Ionicons name="business-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyText}>Select a society to view helpline numbers</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : helplines.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="call-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyText}>{t('noHelpline')}</Text>
          {canManage && (
            <TouchableOpacity style={styles.addFirstBtn} onPress={openAdd}>
              <Text style={styles.addFirstBtnText}>Add First Number</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={helplines}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchHelplines(); }}
            />
          }
        />
      )}

      <BottomSheetModal
        visible={showAdd}
        onClose={() => { setShowAdd(false); resetAddForm(); }}
        title={t('addHelpline')}
      >
        {renderHelplineForm(
          form,
          addErrors,
          setAddErrors,
          (patch) => setForm((f) => ({ ...f, ...patch })),
          addHelpline,
          'Add Helpline',
          isAdmin,
        )}
      </BottomSheetModal>

      <BottomSheetModal
        visible={!!editItem}
        onClose={() => setEditItem(null)}
        title={t('editHelpline')}
      >
        {renderHelplineForm(
          editForm,
          editErrors,
          setEditErrors,
          (patch) => setEditForm((f) => ({ ...f, ...patch })),
          updateHelpline,
          t('saveChanges'),
          false,
        )}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  filterBar: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  card: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardProfession: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  cardPhone: { fontSize: 14, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8 },
  callBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 15, color: Colors.textMuted, textAlign: 'center' },
  addFirstBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  addFirstBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  label: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8,
    marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14,
    fontSize: 15, color: Colors.text, backgroundColor: Colors.bg, marginBottom: 4,
  },
  inputError: { borderColor: Colors.danger, backgroundColor: '#FEF2F2' },
  buildingReadonly: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 14,
    backgroundColor: Colors.bg, marginBottom: 4,
  },
  buildingReadonlyText: { fontSize: 15, color: Colors.text, flex: 1, fontWeight: '600' },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 12, marginTop: 2,
  },
  formErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 8, marginBottom: 4, borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: Colors.danger, flex: 1, fontWeight: '500' },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, padding: 15,
    alignItems: 'center', marginTop: 16, marginBottom: 8,
  },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
