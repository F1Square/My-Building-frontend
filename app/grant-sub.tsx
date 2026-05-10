import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import api from '../utils/api';

type UserOption = { id: string; name: string; email: string };
type PlanOpt = { id: string; slug: string; title: string; months: number | null };

export default function GrantSubScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    user_id: '', plan: '', months: '1', remark: '',
  });

  useEffect(() => {
    (async () => {
      setUsersLoading(true);
      try {
        const [ur, pr] = await Promise.all([
          api.get('/buildings/admin/users'),
          api.get('/subscriptions/plans/admin'),
        ]);
        setUsers((ur.data || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
        const raw = pr.data || [];
        setPlans(
          raw
            .filter((p: any) => p.is_active)
            .map((p: any) => ({ id: p.id, slug: p.slug, title: p.title, months: p.months })),
        );
      } catch {
        Alert.alert('Error', 'Failed to load users or plans');
      } finally {
        setUsersLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!plans.length) return;
    setForm((f) => (f.plan ? f : { ...f, plan: plans[0].slug }));
  }, [plans]);

  const grant = async () => {
    if (!form.user_id) return Alert.alert('Error', 'Select a user');
    if (!form.plan) return Alert.alert('Error', 'Select a plan');
    if (!form.remark.trim()) return Alert.alert('Error', 'Remark is required — add who is handling this');
    const selectedPlan = plans.find((p) => p.slug === form.plan);
    setSubmitting(true);
    try {
      await api.post('/subscriptions/grant', {
        user_id: form.user_id,
        plan: form.plan,
        months: selectedPlan && selectedPlan.months != null ? Number(form.months) : undefined,
        remark: form.remark.trim(),
      });
      Alert.alert('Done', 'Subscription granted', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const selected = users.find(u => u.id === form.user_id);
  const filtered = users.filter(u =>
    !search.trim() ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Grant Subscription</Text>
          <Text style={styles.headerSub}>Manually grant a plan to a user</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>User *</Text>
        <View style={{ marginBottom: 4 }}>
          <TouchableOpacity
            style={[styles.dropdownTrigger, dropdownOpen && styles.dropdownTriggerOpen]}
            onPress={() => { setDropdownOpen(o => !o); setSearch(''); }}
            activeOpacity={0.8}
          >
            <View style={styles.dropdownTriggerAvatar}>
              <Text style={styles.dropdownTriggerAvatarText}>
                {selected ? selected.name[0].toUpperCase() : '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              {selected ? (
                <>
                  <Text style={styles.dropdownTriggerName}>{selected.name}</Text>
                  <Text style={styles.dropdownTriggerEmail}>{selected.email}</Text>
                </>
              ) : (
                <Text style={styles.dropdownTriggerPlaceholder}>
                  {usersLoading ? 'Loading users...' : 'Select a user'}
                </Text>
              )}
            </View>
            <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {dropdownOpen && (
            <View style={styles.dropdownMenu}>
              <View style={styles.dropdownSearch}>
                <Ionicons name="search" size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.dropdownSearchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by name or email..."
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {filtered.length === 0 ? (
                  <Text style={styles.dropdownEmpty}>No users found</Text>
                ) : filtered.map(u => {
                  const active = form.user_id === u.id;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                      onPress={() => { setForm({ ...form, user_id: u.id }); setDropdownOpen(false); setSearch(''); }}
                    >
                      <View style={[styles.dropdownItemAvatar, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                        <Text style={[styles.dropdownItemAvatarText, active && { color: Colors.white }]}>
                          {u.name[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dropdownItemName, active && { color: Colors.white }]}>{u.name}</Text>
                        <Text style={[styles.dropdownItemEmail, active && { color: 'rgba(255,255,255,0.75)' }]}>{u.email}</Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={18} color={Colors.white} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        <Text style={styles.label}>Plan *</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {plans.map((p) => (
            <TouchableOpacity
              key={p.slug}
              style={[styles.planToggle, form.plan === p.slug && styles.planToggleActive]}
              onPress={() => setForm({ ...form, plan: p.slug })}
            >
              <Text style={[styles.planToggleText, form.plan === p.slug && { color: Colors.white }]}>{p.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {plans.length === 0 && !usersLoading ? (
          <Text style={{ color: Colors.textMuted, marginTop: 8 }}>No active plans. Create them under Subscriptions → Plans.</Text>
        ) : null}

        {plans.find((p) => p.slug === form.plan)?.months != null && (
          <>
            <Text style={styles.label}>Months *</Text>
            <TextInput
              style={styles.input}
              value={form.months}
              onChangeText={(v) => setForm({ ...form, months: v })}
              placeholder="e.g. 1 (or match plan duration)"
              keyboardType="number-pad"
              placeholderTextColor={Colors.textMuted}
            />
          </>
        )}

        <Text style={styles.label}>
          Remark * <Text style={{ fontWeight: '400', color: Colors.textMuted }}>(who handled this?)</Text>
        </Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          value={form.remark}
          onChangeText={(v) => setForm({ ...form, remark: v })}
          placeholder="e.g. Collected cash from client — handled by Ravi"
          placeholderTextColor={Colors.textMuted}
          multiline
        />

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: '#10B981' }]}
          onPress={grant}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="gift" size={18} color={Colors.white} />
              <Text style={styles.submitBtnText}>Grant Subscription</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },

  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 15, marginTop: 24 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 12, backgroundColor: Colors.bg },
  dropdownTriggerOpen: { borderColor: Colors.primary, backgroundColor: Colors.white },
  dropdownTriggerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  dropdownTriggerAvatarText: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  dropdownTriggerName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  dropdownTriggerEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  dropdownTriggerPlaceholder: { fontSize: 14, color: Colors.textMuted },
  dropdownMenu: { borderWidth: 1.5, borderColor: Colors.primary + '40', borderRadius: 12, backgroundColor: Colors.white, marginTop: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 6, overflow: 'hidden' },
  dropdownSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg },
  dropdownSearchInput: { flex: 1, fontSize: 14, color: Colors.text },
  dropdownEmpty: { textAlign: 'center', color: Colors.textMuted, padding: 16, fontSize: 13 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemActive: { backgroundColor: Colors.primary },
  dropdownItemAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  dropdownItemAvatarText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  dropdownItemName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  dropdownItemEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  planToggle: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  planToggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  planToggleText: { fontSize: 14, fontWeight: '700', color: Colors.text },
});
