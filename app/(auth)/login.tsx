import React, { useState } from 'react';
import { Colors } from '../../constants/colors';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { formatApiError } from '../../utils/formatApiError';
import { isValidEmail } from '../../utils/authValidation';
import { useKeyboardPad } from '../../hooks/useKeyboardPad';
import { FieldError, FormErrorBanner, formFieldErrorStyles } from '../../components/FormFieldError';

type FormErrors = {
  email?: string;
  password?: string;
  general?: string;
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const keyboardPad = useKeyboardPad();
  const { login } = useAuth();
  const router = useRouter();

  const clearFieldError = (field: keyof FormErrors) => {
    setErrors((prev) => {
      if (!prev[field] && !prev.general) return prev;
      return { ...prev, [field]: undefined, general: undefined };
    });
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!email.trim()) next.email = 'Email is required';
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address (e.g. user@example.com)';
    if (!password) next.password = 'Password is required';
    return next;
  };

  const handleLogin = async () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    setErrors({});
    try {
      api.post('/auth/client-log', { action: 'frontend_login_started', userEmail: email.trim(), detail: { step: '1_clicked_button' } }).catch(()=>{});
      const res = await api.post('/auth/login/unified', { email: email.trim(), password });
      api.post('/auth/client-log', { action: 'frontend_login_api_done', userEmail: email.trim(), detail: { step: '2_api_returned_success' } }).catch(()=>{});
      const token = res.data?.token;
      const userPayload = res.data?.user;
      if (typeof token !== 'string' || !token || !userPayload?.id) {
        api.post('/auth/client-log', { action: 'frontend_login_invalid_payload', userEmail: email.trim(), detail: { step: 'error_no_token' } }).catch(()=>{});
        setErrors({ general: 'Invalid response from server. Please try again.' });
        return;
      }
      api.post('/auth/client-log', { action: 'frontend_login_context_start', userEmail: email.trim(), detail: { step: '3_calling_auth_context_login' } }).catch(()=>{});
      await login(token, userPayload, res.data.subscription ?? null);
      api.post('/auth/client-log', { action: 'frontend_login_context_done', userEmail: email.trim(), detail: { step: '4_auth_context_login_finished' } }).catch(()=>{});
      // Navigation is handled automatically by _layout.tsx when user state changes.
      // Do NOT call router.replace('/') here — it races with the layout routing
      // effect and causes a native crash in production (two concurrent REPLACE
      // actions on a navigator that's being re-mounted).
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const fallback =
        status === 401 || status === 400 || status === 422
          ? 'Invalid email or password'
          : 'Login failed. Please try again.';
      setErrors({ general: formatApiError(e, fallback) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(48, keyboardPad + 32) },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator
          bounces
        >
          <View style={styles.header}>
            <Text style={styles.logo}>🏢</Text>
            <Text style={styles.title}>My Building</Text>
            <Text style={styles.subtitle}>Society Management App</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSub}>Sign in to continue</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email ? formFieldErrorStyles.inputError : null]}
              placeholder="your@email.com"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                clearFieldError('email');
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={Colors.textMuted}
            />
            <FieldError message={errors.email} />

            <Text style={styles.label}>Password</Text>
            <View style={[styles.passwordRow, errors.password ? formFieldErrorStyles.inputError : null]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  clearFieldError('password');
                }}
                secureTextEntry={!showPassword}
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FieldError message={errors.password} />

            <FormErrorBanner message={errors.general} />

            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
              {loading
                ? <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.btnText}>Signing in...</Text>
                </View>
                : <Text style={styles.btnText}>Sign In</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/forgot-password' as any)} style={styles.forgotLink}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/register' as any)} style={styles.link}>
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkBold}>Register</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 64 },
  title: { fontSize: 32, fontWeight: '800', color: Colors.white, marginTop: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  card: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: 14, color: Colors.textMuted, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12,
    fontSize: 15, color: Colors.text, marginBottom: 4, backgroundColor: Colors.bg, letterSpacing: 0,
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.bg, marginBottom: 4,
  },
  passwordInput: { flex: 1, padding: 12, fontSize: 15, color: Colors.text, letterSpacing: 0 },
  eyeBtn: { paddingHorizontal: 12 },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: Colors.textMuted, fontSize: 14 },
  linkBold: { color: Colors.primary, fontWeight: '700' },
  forgotLink: { marginTop: 14, alignItems: 'center' },
  forgotText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
