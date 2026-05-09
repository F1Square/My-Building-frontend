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
  const [codeInput, setCodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedBuilding, setVerifiedBuilding] = useState<any>(null);
  const [codeError, setCodeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll for Pramukh approval every 5 seconds after request is sent
  useEffect(() => {
    if (submitted) {
      pollRef.current = setInterval(async () => { await refreshUser(); }, 5000);
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

  // Auto-verify building code after user stops typing (≥4 chars)
  useEffect(() => {
    const trimmed = codeInput.trim();
    setVerifiedBuilding(null);
    setCodeError('');
    if (trimmed.length < 4) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setVerifying(true);
      try {
        const res = await api.get(`/buildings/verify-code?code=${encodeURIComponent(trimmed)}`);
        setVerifiedBuilding(res.data);
      } catch (e: any) {
        // Use the backend's specific error message so the user knows exactly what went wrong
        setCodeError(e.response?.data?.error || 'Could not verify code. Please try again.');
      } finally {
        setVerifying(false);
      }
    }, 500);
  }, [codeInput]);

  const handleJoin = async () => {
    if (!verifiedBuilding) return;
    setSubmitting(true);
    try {
      await api.post('/buildings/join', { building_code: verifiedBuilding.building_code });
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
            Your request has been sent to the Pramukh of {verifiedBuilding?.name}. You'll be notified once they approve you.
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
          <Ionicons name="key-outline" size={22} color={Colors.primary} />
          <Text style={styles.infoText}>
            Enter the Building Code shared by your Pramukh. It is a short code (4–12 characters) that uniquely identifies your society.
          </Text>
        </View>

        <Text style={styles.label}>Building Code</Text>
        <View style={styles.codeRow}>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={codeInput}
            onChangeText={(v) => setCodeInput(v.toUpperCase())}
            placeholder="e.g., ABC123"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
          />
          {verifying && (
            <ActivityIndicator style={styles.codeSpinner} color={Colors.primary} />
          )}
          {!verifying && verifiedBuilding && (
            <Ionicons name="checkmark-circle" size={24} color={Colors.success} style={styles.codeSpinner} />
          )}
          {!verifying && codeError !== '' && (
            <Ionicons name="close-circle" size={24} color={Colors.danger} style={styles.codeSpinner} />
          )}
        </View>

        {codeError !== '' && (
          <Text style={styles.codeErrorText}>{codeError}</Text>
        )}

        {verifiedBuilding && (
          <View style={styles.previewBox}>
            <View style={styles.previewHeader}>
              <Ionicons name="business-outline" size={20} color={Colors.primary} />
              <Text style={styles.previewLabel}>Building Found</Text>
            </View>
            <Text style={styles.previewName}>{verifiedBuilding.name}</Text>
            {verifiedBuilding.address ? (
              <Text style={styles.previewAddress}>{verifiedBuilding.address}</Text>
            ) : null}
            <View style={styles.previewCodeBadge}>
              <Text style={styles.previewCodeText}>Code: {verifiedBuilding.building_code}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, !verifiedBuilding && { opacity: 0.45 }]}
          onPress={handleJoin}
          disabled={submitting || !verifiedBuilding}
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
    padding: 14, fontSize: 15, color: Colors.text, backgroundColor: Colors.white,
  },
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  codeInput: { flex: 1, letterSpacing: 2, fontWeight: '700' },
  codeSpinner: { marginLeft: 10 },
  codeErrorText: { fontSize: 12, color: Colors.danger, marginTop: 6 },
  previewBox: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    marginTop: 16, borderWidth: 1.5, borderColor: Colors.success,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  previewLabel: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  previewName: { fontSize: 17, color: Colors.text, fontWeight: '800', marginBottom: 4 },
  previewAddress: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  previewCodeBadge: {
    alignSelf: 'flex-start', marginTop: 10,
    backgroundColor: Colors.primary + '15', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  previewCodeText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, padding: 16, marginTop: 24,
  },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  note: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 20 },
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
