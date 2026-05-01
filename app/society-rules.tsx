import React, { useState, useCallback } from 'react';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useBuildings, Building } from '../hooks/useBuildings';
import BuildingDropdown from '../components/BuildingDropdown';

const RULE_CATEGORIES = ['General', 'Parking', 'Noise', 'Cleanliness', 'Security', 'Pets', 'Guests', 'Other'];

const CAT_ICONS: Record<string, string> = {
  General: 'document-text-outline',
  Parking: 'car-outline',
  Noise: 'volume-high-outline',
  Cleanliness: 'trash-outline',
  Security: 'shield-outline',
  Pets: 'paw-outline',
  Guests: 'people-outline',
  Other: 'ellipsis-horizontal-circle-outline',
};

const CAT_COLORS: Record<string, string> = {
  General: '#3B5FC0', Parking: '#0D9488', Noise: '#D97706',
  Cleanliness: '#16A34A', Security: '#EF4444', Pets: '#EC4899',
  Guests: '#7C3AED', Other: '#6B7280',
};

type Rule = {
  id: string;
  title: string;
  description?: string;
  category: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  creator?: { name: string } | null;
  updater?: { name: string } | null;
};

export default function SocietyRulesScreen() {
  const router = useRouter();
  const { user, hasActiveSubscription } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh';
  const canEdit = isAdmin || isPramukh;
  const isLocked = !isAdmin && !hasActiveSubscription;

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Rule | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'General', order_index: '0' });
  const [submitting, setSubmitting] = useState(false);

  const effectiveBuildingId = isAdmin ? selectedBuilding?.id : user?.building_id;

  const fetchRules = useCallback(async () => {
    if (!effectiveBuildingId) { setLoading(false); setRefreshing(false); return; }
    try {
      const res = await api.get('/society-rules', {
        params: isAdmin ? { building_id: effectiveBuildingId } : undefined,
      });
      setRules(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [effectiveBuildingId]);

  useFocusEffect(useCallback(() => { fetchRules(); }, [effectiveBuildingId]));

  const openAdd = () => {
    setEditTarget(null);
    setForm({ title: '', description: '', category: 'General', order_index: String(rules.length) });
    setShowForm(true);
  };

  const openEdit = (rule: Rule) => {
    setEditTarget(rule);
    setForm({
      title: rule.title,
      description: rule.description || '',
      category: rule.category || 'General',
      order_index: String(rule.order_index ?? 0),
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return Alert.alert('Error', 'Title is required');
    setSubmitting(true);
    try {
      const body: any = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        order_index: parseInt(form.order_index) || 0,
      };
      if (isAdmin && effectiveBuildingId) body.building_id = effectiveBuildingId;

      if (editTarget) {
        await api.patch(`/society-rules/${editTarget.id}`, body);
      } else {
        await api.post('/society-rules', body);
      }
      setShowForm(false);
      fetchRules();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save rule');
    } finally { setSubmitting(false); }
  };

  const handleDelete = (rule: Rule) => {
    Alert.alert('Delete Rule', `Delete "${rule.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/society-rules/${rule.id}`);
          fetchRules();
        } catch (e: any) {
          Alert.alert('Error', e?.response?.data?.error || 'Failed to delete');
        }
      }},
    ]);
  };

  const renderRule = ({ item, index }: { item: Rule; index: number }) => {
    const color = CAT_COLORS[item.category] || CAT_COLORS.General;
    const icon = CAT_ICONS[item.category] || CAT_ICONS.General;
    return (
      <View style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.cardTop}>
          <View style={[styles.numBadge, { backgroundColor: color + '18' }]}>
            <Text style={[styles.numText, { color }]}>{index + 1}</Text>
          </View>
          <View style={[styles.catIcon, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon as any} size={16} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ruleTitle}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.ruleDesc}>{item.description}</Text>
            ) : null}
            <View style={styles.ruleMeta}>
              <View style={[styles.catChip, { backgroundColor: color + '15' }]}>
                <Text style={[styles.catChipText, { color }]}>{item.category}</Text>
              </View>
              {item.updater?.name && (
                <Text style={styles.updatedBy}>Updated by {item.updater.name}</Text>
              )}
            </View>
          </View>
          {canEdit && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
                <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
              </TouchableOpacity>
              {isAdmin && (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.danger + '15' }]} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const showContent = !isAdmin || selectedBuilding;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Society Rules</Text>
          <Text style={styles.headerSub}>
            {isAdmin ? (selectedBuilding?.name || 'Select a society') : `${rules.length} rule${rules.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        {canEdit && showContent && !isLocked && (
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={22} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {/* Admin: building dropdown */}
      {isAdmin && (
        <View style={styles.dropdownWrap}>
          <BuildingDropdown
            buildings={buildings}
            loading={buildingsLoading}
            selected={selectedBuilding}
            onSelect={setSelectedBuilding}
            label="Select Society"
          />
        </View>
      )}

      {/* Content */}
      {isLocked ? (
        <View style={styles.lockedContainer}>
          <View style={styles.lockedIconBox}>
            <Ionicons name="lock-closed" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.lockedTitle}>Subscription Required</Text>
          <Text style={styles.lockedDesc}>
            Subscribe to view and manage society rules.
          </Text>
          <TouchableOpacity style={styles.lockedBtn} onPress={() => router.push('/subscribe' as any)}>
            <Ionicons name="star-outline" size={18} color={Colors.white} />
            <Text style={styles.lockedBtnText}>View Plans</Text>
          </TouchableOpacity>
        </View>
      ) : !showContent ? (
        <View style={styles.empty}>
          <Ionicons name="business-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>Select a society</Text>
          <Text style={styles.emptySub}>Choose a society above to view its rules</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={rules}
          keyExtractor={i => i.id}
          renderItem={renderRule}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRules(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyTitle}>No Rules Yet</Text>
              <Text style={styles.emptySub}>
                {canEdit ? 'Tap + to add the first rule' : 'No society rules have been added yet'}
              </Text>
            </View>
          }
        />
      )}

      {/* Add / Edit Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editTarget ? 'Edit Rule' : 'Add Rule'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. No loud music after 10 PM"
                value={form.title}
                onChangeText={v => setForm(f => ({ ...f, title: v }))}
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                placeholder="Optional details..."
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                multiline
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
                  {RULE_CATEGORIES.map(cat => {
                    const active = form.category === cat;
                    const color = CAT_COLORS[cat] || CAT_COLORS.General;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
                        onPress={() => setForm(f => ({ ...f, category: cat }))}
                      >
                        <Ionicons name={CAT_ICONS[cat] as any} size={13} color={active ? Colors.white : Colors.textMuted} />
                        <Text style={[styles.chipText, active && { color: Colors.white }]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={styles.label}>Order (lower = first)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={form.order_index}
                onChangeText={v => setForm(f => ({ ...f, order_index: v }))}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.submitBtnText}>{editTarget ? 'Save Changes' : 'Add Rule'}</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3 },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  dropdownWrap: { padding: 16, paddingBottom: 0 },
  card: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    marginBottom: 10, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  numBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  numText: { fontSize: 13, fontWeight: '800' },
  catIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  ruleTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  ruleDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: 6 },
  ruleMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  catChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  catChipText: { fontSize: 11, fontWeight: '700' },
  updatedBy: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 6, marginLeft: 4 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  empty: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '90%',
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: Colors.text,
    backgroundColor: Colors.bg, marginBottom: 4,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: Colors.bg,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  submitBtn: {
    marginTop: 20, backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  // Locked / paywall state
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
