import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Colors } from '../../constants/colors';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function JoinBuildingScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll for approval every 5 seconds after request is sent
  useEffect(() => {
    if (submitted) {
      pollRef.current = setInterval(async () => {
        await refreshUser();
      }, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [submitted]);

  // When user gets building_id (approved), navigate to home
  useEffect(() => {
    if (user?.building_id) {
      if (pollRef.current) clearInterval(pollRef.current);
      router.replace('/' as any);
    }
  }, [user?.building_id]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2 && !selectedBuilding) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      setSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await api.get(`/buildings/search?query=${encodeURIComponent(searchQuery)}`);
          setSearchResults(res.data);
        } catch (e) {
          console.error(e);
        } finally {
          setSearching(false);
        }
      }, 500);
    } else {
      setSearchResults([]);
      setSearching(false);
    }
  }, [searchQuery, selectedBuilding]);

  const handleJoin = async () => {
    if (!selectedBuilding) return Alert.alert('Error', 'Please select a building to join');

    setSubmitting(true);
    try {
      await api.post('/buildings/join', { building_id: selectedBuilding.id });
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Building</Text>
        </View>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Request Sent!</Text>
          <Text style={styles.successSubtitle}>
            Your request has been sent to the Pramukh of {selectedBuilding?.name}. You'll be notified once they approve you.
          </Text>
          <View style={styles.waitingCard}>
            <Ionicons name="time-outline" size={20} color={Colors.warning} />
            <Text style={styles.waitingText}>Waiting for Pramukh approval...</Text>
          </View>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace('/' as any)}>
            <Text style={styles.backHomeBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join a Building</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Ionicons name="search-outline" size={22} color={Colors.primary} />
          <Text style={styles.infoText}>
            Search for your society by name. Once you find it, select it to send a join request to the Pramukh.
          </Text>
        </View>

        <Text style={styles.label}>Society Name</Text>
        <TextInput
          style={styles.input}
          value={searchQuery}
          onChangeText={(v) => { setSearchQuery(v); setSelectedBuilding(null); }}
          placeholder="e.g., Maheta Nagar"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
        />

        {searching && <ActivityIndicator style={{ marginTop: 16 }} color={Colors.primary} />}

        {!searching && searchQuery.length >= 2 && searchResults.length === 0 && !selectedBuilding && (
          <Text style={styles.noResultsText}>No societies found matching "{searchQuery}"</Text>
        )}

        {!selectedBuilding && searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            {searchResults.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={styles.resultItem}
                onPress={() => {
                  setSelectedBuilding(b);
                  setSearchQuery(b.name);
                  setSearchResults([]);
                  Keyboard.dismiss();
                }}
              >
                <Ionicons name="business-outline" size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{b.name}</Text>
                  {b.address && <Text style={styles.resultAddress}>{b.address}</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedBuilding && (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Selected Society:</Text>
            <Text style={styles.previewId}>{selectedBuilding.name}</Text>
            {selectedBuilding.address && <Text style={styles.previewAddress}>{selectedBuilding.address}</Text>}
            <TouchableOpacity style={styles.clearBtn} onPress={() => { setSelectedBuilding(null); setSearchQuery(''); }}>
              <Text style={styles.clearBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, !selectedBuilding && { opacity: 0.5 }]}
          onPress={handleJoin}
          disabled={submitting || !selectedBuilding}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : (
              <>
                <Ionicons name="enter-outline" size={20} color={Colors.white} />
                <Text style={styles.submitBtnText}>Send Join Request</Text>
              </>
            )
          }
        </TouchableOpacity>

        <Text style={styles.note}>
          Once you submit, the Pramukh of that building will receive a notification and can approve or reject your request.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  content: { padding: 20 },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.primary + '15', borderRadius: 12, padding: 14, marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    padding: 14, fontSize: 14, color: Colors.text, backgroundColor: Colors.white,
  },
  resultsContainer: { backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginTop: 8, maxHeight: 250 },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  resultName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  resultAddress: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  noResultsText: { textAlign: 'center', color: Colors.textMuted, marginTop: 16, fontSize: 13 },
  previewBox: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 16,
    marginTop: 16, borderWidth: 1.5, borderColor: Colors.primary,
  },
  previewLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  previewId: { fontSize: 16, color: Colors.text, fontWeight: '800' },
  previewAddress: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  clearBtn: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.bg, borderRadius: 6 },
  clearBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, padding: 16, marginTop: 24,
  },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  note: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  // Success state
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  successSubtitle: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  waitingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.warning + '20', borderRadius: 10, padding: 14, marginBottom: 32,
  },
  waitingText: { fontSize: 14, color: Colors.warning, fontWeight: '600' },
  backHomeBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  backHomeBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
