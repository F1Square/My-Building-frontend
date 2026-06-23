import React, { useState, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, ToastAndroid,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

type Wing = {
  wing: string;
};

export default function ExpensesWingSelectScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh';
  const canManage = isPramukh || isAdmin;

  const [wings, setWings] = useState<Wing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const buildingId = user?.building_id;

  const fetchWings = async () => {
    if (!buildingId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(false);
    try {
      const res = await api.get('/expenses/wings', { params: { building_id: buildingId } });
      setWings(res.data || []);
    } catch (e: any) {
      console.error('[ExpensesWingSelect] Error fetching wings:', e);
      ToastAndroid.show(e.response?.data?.error || 'Failed to load wings', ToastAndroid.LONG);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchWings();
  }, [buildingId]));

  const handleWingSelect = (wing: string) => {
    router.push({
      pathname: '/expenses-detail',
      params: { wing },
    } as any);
  };

  const renderWing = ({ item }: { item: Wing }) => (
    <TouchableOpacity
      style={styles.wingCard}
      onPress={() => handleWingSelect(item.wing)}
      activeOpacity={0.75}
    >
      <View style={styles.wingIconBox}>
        <Ionicons name="home-outline" size={32} color={Colors.primary} />
      </View>
      <View style={styles.wingInfo}>
        <Text style={styles.wingLabel}>Wing</Text>
        <Text style={styles.wingName}>{item.wing || 'Building-Wide'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('expenses')}</Text>
          <Text style={styles.headerSub}>Select Wing</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : error ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyText}>Could not load wings</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchWings(); }}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !buildingId ? (
        <View style={styles.empty}>
          <Ionicons name="business-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyText}>No building assigned</Text>
        </View>
      ) : wings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="home-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyText}>No wings configured</Text>
          {canManage && <Text style={styles.emptyHint}>Configure wings in building settings</Text>}
        </View>
      ) : (
        <FlatList
          data={wings}
          keyExtractor={(item, idx) => `${item.wing || 'building-wide'}-${idx}`}
          renderItem={renderWing}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWings(); }} />}
          ListHeaderComponent={
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>
                Select a wing to view and manage its expenses separately
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  list: { padding: 16 },
  wingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  wingIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  wingInfo: { flex: 1 },
  wingLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  wingName: { fontSize: 16, fontWeight: '800', color: Colors.text, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyText: { fontSize: 17, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  emptyHint: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.primary, fontWeight: '600', lineHeight: 18 },
});
