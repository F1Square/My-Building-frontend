import React, { useState, useCallback, useMemo } from 'react';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../utils/api';
import { useBuildings, Building } from '../hooks/useBuildings';
import BuildingDropdown from '../components/BuildingDropdown';
import { ModuleHeader, ModuleHeaderIconButton } from '../components/ModuleHeader';
import SocietyRuleDetailModal, { SocietyRuleDetail } from '../components/SocietyRuleDetailModal';
import { RULE_CATEGORIES, CAT_ICONS, CAT_COLORS } from '../constants/societyRules';

type Rule = SocietyRuleDetail & {
  building_id?: string;
};

const DESC_PREVIEW_LEN = 110;

export default function SocietyRulesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, hasActiveSubscription } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh';
  const canEdit = isAdmin || isPramukh;
  const canDelete = canEdit;
  const isLocked = !isAdmin && !hasActiveSubscription;

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Rule | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'General' });
  const [submitting, setSubmitting] = useState(false);

  const effectiveBuildingId = isAdmin ? selectedBuilding?.id : user?.building_id;

  const fetchRules = useCallback(async () => {
    if (!effectiveBuildingId) {
      setRules([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await api.get('/society-rules', {
        params: isAdmin ? { building_id: effectiveBuildingId } : undefined,
      });
      setRules(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      Alert.error('Error', e?.response?.data?.error || 'Failed to load rules', 4000);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveBuildingId, isAdmin]);

  useFocusEffect(useCallback(() => { fetchRules(); }, [fetchRules]));

  const filteredRules = useMemo(() => {
    if (categoryFilter === 'All') return rules;
    return rules.filter((r) => (r.category || 'General') === categoryFilter);
  }, [rules, categoryFilter]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ title: '', description: '', category: 'General' });
    setShowForm(true);
  };

  const openEdit = (rule: Rule) => {
    setEditTarget(rule);
    setForm({
      title: rule.title,
      description: rule.description || '',
      category: rule.category || 'General',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return Alert.error('Error', 'Title is required', 4000);
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
      };
      if (isAdmin && effectiveBuildingId) body.building_id = effectiveBuildingId;

      if (editTarget) {
        const res = await api.patch(`/society-rules/${editTarget.id}`, body);
        setRules((prev) => prev.map((r) => (r.id === editTarget.id ? { ...r, ...res.data } : r)));
        setSelectedRule((prev) => (prev?.id === editTarget.id ? { ...prev, ...res.data } : prev));
      } else {
        const res = await api.post('/society-rules', body);
        setRules((prev) => [...prev, res.data].sort((a, b) =>
          (a.order_index ?? 0) - (b.order_index ?? 0) ||
          String(a.created_at).localeCompare(String(b.created_at)),
        ));
      }
      setShowForm(false);
    } catch (e: any) {
      Alert.error('Error', e?.response?.data?.error || 'Failed to save rule', 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (rule: Rule) => {
    Alert.alert('Delete Rule', `Delete "${rule.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/society-rules/${rule.id}`);
            setRules((prev) => prev.filter((r) => r.id !== rule.id));
            if (selectedRule?.id === rule.id) setSelectedRule(null);
          } catch (e: any) {
            Alert.error('Error', e?.response?.data?.error || 'Failed to delete', 4000);
          }
        },
      },
    ]);
  };

  const renderRule = ({ item, index }: { item: Rule; index: number }) => {
    const color = CAT_COLORS[item.category] || CAT_COLORS.General;
    const icon = CAT_ICONS[item.category] || CAT_ICONS.General;
    const desc = item.description?.trim() || '';
    const preview = desc.length > DESC_PREVIEW_LEN
      ? `${desc.slice(0, DESC_PREVIEW_LEN).trim()}…`
      : desc;

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: color }]}
        onPress={() => setSelectedRule(item)}
        activeOpacity={0.75}
      >
        <View style={styles.cardTop}>
          <View style={[styles.numBadge, { backgroundColor: color + '18' }]}>
            <Text style={[styles.numText, { color }]}>{index + 1}</Text>
          </View>
          <View style={[styles.catIcon, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon as any} size={16} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ruleTitle}>{item.title}</Text>
            {preview ? <Text style={styles.ruleDesc} numberOfLines={2}>{preview}</Text> : null}
            <View style={styles.ruleMeta}>
              <View style={[styles.catChip, { backgroundColor: color + '15' }]}>
                <Text style={[styles.catChipText, { color }]}>{item.category}</Text>
              </View>
              {item.updater?.name ? (
                <Text style={styles.updatedBy}>Updated by {item.updater.name}</Text>
              ) : null}
            </View>
          </View>
          {canEdit && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={(e) => { e.stopPropagation?.(); openEdit(item); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
              </TouchableOpacity>
              {canDelete && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.danger + '15' }]}
                  onPress={(e) => { e.stopPropagation?.(); handleDelete(item); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const showContent = !isAdmin || selectedBuilding;

  return (
    <View style={styles.container}>
      <ModuleHeader
        title={t('societyRules')}
        subtitle={isAdmin ? (selectedBuilding?.name || 'Select a society') : `${rules.length} rule${rules.length !== 1 ? 's' : ''}`}
        rightAction={canEdit && showContent && !isLocked ? <ModuleHeaderIconButton icon="add" onPress={openAdd} /> : undefined}
      />

      {isAdmin && (
        <View style={styles.dropdownWrap}>
          <BuildingDropdown
            buildings={buildings}
            loading={buildingsLoading}
            selected={selectedBuilding}
            onSelect={(b) => { setSelectedBuilding(b); setCategoryFilter('All'); }}
            label="Select Society"
          />
        </View>
      )}

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
          data={filteredRules}
          keyExtractor={(i) => i.id}
          renderItem={renderRule}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchRules(); }}
            />
          )}
          ListHeaderComponent={
            rules.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                style={{ marginBottom: 12 }}
              >
                {['All', ...RULE_CATEGORIES].map((cat) => {
                  const active = categoryFilter === cat;
                  const color = cat === 'All' ? Colors.primary : (CAT_COLORS[cat] || Colors.primary);
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.filterChip, active && { backgroundColor: color, borderColor: color }]}
                      onPress={() => setCategoryFilter(cat)}
                    >
                      {cat !== 'All' && (
                        <Ionicons
                          name={(CAT_ICONS[cat] || CAT_ICONS.General) as any}
                          size={12}
                          color={active ? Colors.white : Colors.textMuted}
                        />
                      )}
                      <Text style={[styles.filterChipText, active && { color: Colors.white }]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyTitle}>
                {categoryFilter !== 'All' ? 'No rules in this category' : 'No Rules Yet'}
              </Text>
              <Text style={styles.emptySub}>
                {categoryFilter !== 'All'
                  ? 'Try another filter or add a new rule'
                  : canEdit
                    ? 'Tap + to add the first rule'
                    : 'No society rules have been added yet'}
              </Text>
            </View>
          }
        />
      )}

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
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                placeholderTextColor={Colors.textMuted}
                maxLength={150}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                placeholder="Optional details..."
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                multiline
                placeholderTextColor={Colors.textMuted}
                maxLength={2000}
              />

              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
                  {RULE_CATEGORIES.map((cat) => {
                    const active = form.category === cat;
                    const color = CAT_COLORS[cat] || CAT_COLORS.General;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
                        onPress={() => setForm((f) => ({ ...f, category: cat }))}
                      >
                        <Ionicons name={CAT_ICONS[cat] as any} size={13} color={active ? Colors.white : Colors.textMuted} />
                        <Text style={[styles.chipText, active && { color: Colors.white }]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.submitBtnText}>{editTarget ? 'Save Changes' : 'Add Rule'}</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <SocietyRuleDetailModal
        visible={!!selectedRule}
        rule={selectedRule}
        onClose={() => setSelectedRule(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  dropdownWrap: { padding: 16, paddingBottom: 0 },
  filterRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
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
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.bg,
    marginBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.bg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  submitBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  lockedIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  lockedTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  lockedDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  lockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  lockedBtnText: { fontSize: 15, fontWeight: '800', color: Colors.white },
});
