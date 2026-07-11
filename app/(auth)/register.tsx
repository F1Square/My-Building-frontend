import React, { useState } from 'react';
import { Colors } from '../../constants/colors';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { isValidEmail, isValidPhone } from '../../utils/authValidation';
import { useKeyboardPad } from '../../hooks/useKeyboardPad';
import { FieldError, FormErrorBanner, formFieldErrorStyles } from '../../components/FormFieldError';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One digit', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

type FormErrors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  general?: string;
};

export default function RegisterScreen() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const keyboardPad = useKeyboardPad();
  const router = useRouter();

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((prev) => {
      if (!prev[k] && !prev.general) return prev;
      return { ...prev, [k]: undefined, general: undefined };
    });
  };

  const passwordStrength = PASSWORD_RULES.filter((r) => r.test(form.password)).length;
  const strengthColor = passwordStrength <= 2 ? Colors.danger : passwordStrength <= 3 ? Colors.warning : Colors.success;
  const strengthLabel = passwordStrength <= 2 ? 'Weak' : passwordStrength <= 3 ? 'Fair' : passwordStrength === 4 ? 'Good' : 'Strong';

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = 'Full name is required';
    else if (form.name.trim().length > 100) next.name = 'Name must not exceed 100 characters';

    if (!form.email.trim()) next.email = 'Email is required';
    else if (!isValidEmail(form.email)) next.email = 'Enter a valid email address (e.g. user@example.com)';

    if (!form.phone.trim()) next.phone = 'Phone number is required';
    else if (!isValidPhone(form.phone)) {
      next.phone = 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9';
    }

    if (!form.password) next.password = 'Password is required';
    else {
      const failedRule = PASSWORD_RULES.find((r) => !r.test(form.password));
      if (failedRule) next.password = failedRule.label;
    }
    return next;
  };

  const handleRegister = async () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    setErrors({});
    try {
      await api.post('/auth/signup', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      Alert.success('Account created', 'You can now log in and join a building.', 4000);
      router.back();
    } catch (e: any) {
      setErrors({ general: e.response?.data?.error || 'Registration failed' });
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
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.logo}>🏢</Text>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join your building community</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.name ? formFieldErrorStyles.inputError : null]}
              placeholder="Your full name"
              value={form.name}
              onChangeText={(v) => set('name', v)}
              autoCapitalize="words"
              placeholderTextColor={Colors.textMuted}
            />
            <FieldError message={errors.name} />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email ? formFieldErrorStyles.inputError : null]}
              placeholder="your@email.com"
              value={form.email}
              onChangeText={(v) => set('email', v)}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={Colors.textMuted}
            />
            <FieldError message={errors.email} />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, errors.phone ? formFieldErrorStyles.inputError : null]}
              placeholder="9876543210"
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              keyboardType="phone-pad"
              maxLength={10}
              placeholderTextColor={Colors.textMuted}
            />
            <FieldError message={errors.phone} />

            <Text style={styles.label}>Password</Text>
            <View style={[styles.passwordRow, errors.password ? formFieldErrorStyles.inputError : null]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                value={form.password}
                onChangeText={(v) => set('password', v)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FieldError message={errors.password} />

            {form.password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  {PASSWORD_RULES.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.strengthSegment, { backgroundColor: i < passwordStrength ? strengthColor : Colors.border }]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strengthLabel}</Text>
              </View>
            )}

            {form.password.length > 0 && (
              <View style={styles.rulesList}>
                {PASSWORD_RULES.map((rule) => (
                  <View key={rule.label} style={styles.ruleRow}>
                    <Ionicons
                      name={rule.test(form.password) ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={rule.test(form.password) ? Colors.success : Colors.textMuted}
                    />
                    <Text style={[styles.ruleText, { color: rule.test(form.password) ? Colors.success : Colors.textMuted }]}>
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <FormErrorBanner message={errors.general} />

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
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
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  header: { alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 48 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.white, marginTop: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  card: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12,
    fontSize: 15, color: Colors.text, marginBottom: 4, backgroundColor: Colors.bg,
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.bg, marginBottom: 4,
  },
  passwordInput: { flex: 1, padding: 12, fontSize: 15, color: Colors.text },
  eyeBtn: { paddingHorizontal: 12 },
  strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, marginTop: 6 },
  strengthBar: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '700', width: 48, textAlign: 'right' },
  rulesList: { marginBottom: 16, gap: 5 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { fontSize: 12 },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
