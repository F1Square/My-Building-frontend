import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Easing,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import api from '../../utils/api';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8, weight: 1 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p), weight: 1 },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p), weight: 1 },
  { label: 'One digit', test: (p: string) => /[0-9]/.test(p), weight: 1 },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p), weight: 1 },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'email' | 'otp' | 'password' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  
  // Refs for auto-focus
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  // Success animation
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const scrollToInput = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const passwordStrength = PASSWORD_RULES.filter((r) => r.test(newPassword)).length;
  const strengthColor = passwordStrength <= 2 ? Colors.danger : passwordStrength <= 3 ? Colors.warning : Colors.success;
  const strengthLabel = passwordStrength <= 2 ? 'Weak' : passwordStrength <= 3 ? 'Fair' : passwordStrength === 4 ? 'Good' : 'Strong';

  const isValidEmail = (email: string) => EMAIL_REGEX.test(email.trim());

  const sendOtp = async () => {
    if (loading) return; // Prevent multiple calls
    if (!email.trim()) return Alert.error('Error', 'Please enter your email', 4000);
    if (!isValidEmail(email)) return Alert.error('Error', 'Please enter a valid email address', 4000);
    
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      Alert.success('OTP Sent', `A 6-digit OTP has been sent to ${email.trim()}`, 4000);
      setStep('otp');
      setResendTimer(60); // Start 60 second countdown
      // Auto-focus first OTP box
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 300);
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed to send OTP', 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (loading) return; // Prevent changes during loading
    
    // Handle paste
    if (value.length > 1) {
      const pastedCode = value.slice(0, 6).split('');
      const newOtp = [...otp];
      pastedCode.forEach((char, i) => {
        if (index + i < 6) {
          newOtp[index + i] = char;
        }
      });
      setOtp(newOtp);
      
      // Focus last filled box or verify if complete
      const lastFilledIndex = Math.min(index + pastedCode.length - 1, 5);
      if (lastFilledIndex < 5) {
        otpRefs.current[lastFilledIndex + 1]?.focus();
      } else {
        otpRefs.current[5]?.blur();
        // Auto-submit if complete
        if (newOtp.join('').length === 6) {
          verifyOtpAuto(newOtp.join(''));
        }
      }
      return;
    }

    // Single character input
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-move to next box
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newOtp.join('').length === 6) {
      verifyOtpAuto(newOtp.join(''));
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    // Auto backspace to previous box
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtpAuto = async (otpCode: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email: email.trim(), otp: otpCode });
      setResetToken(res.data.reset_token);
      setStep('password');
      // Auto-focus password field
      setTimeout(() => {
        passwordRef.current?.focus();
      }, 300);
    } catch (e: any) {
      Alert.error('Invalid OTP', e.response?.data?.error || 'OTP verification failed', 4000);
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (loading) return;
    const otpCode = otp.join('');
    if (otpCode.length !== 6) return Alert.error('Error', 'Please enter the 6-digit OTP', 4000);
    await verifyOtpAuto(otpCode);
  };

  const resetPassword = async () => {
    if (loading) return; // Prevent multiple calls
    
    const failedRule = PASSWORD_RULES.find((r) => !r.test(newPassword));
    if (failedRule) return Alert.error('Weak Password', failedRule.label, 4000);
    
    if (newPassword !== confirmPassword) {
      return Alert.error('Password Mismatch', 'Passwords do not match. Please try again.', 4000);
    }
    
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { reset_token: resetToken, new_password: newPassword });
      
      // Show success animation
      setStep('success');
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Navigate to login after 2 seconds
      setTimeout(() => {
        router.replace('/login' as any);
      }, 2000);
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed to reset password', 4000);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (loading || resendTimer > 0) return;
    await sendOtp();
  };

  const stepIndex = step === 'email' ? 0 : step === 'otp' ? 1 : step === 'password' ? 2 : 3;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        </View>
      )}
      
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          pointerEvents={loading ? 'none' : 'auto'}
        >
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.back}
          accessible
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.logo}>🔐</Text>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>We'll send an OTP to your email</Text>
        </View>

        {/* Step indicator */}
        {step !== 'success' && (
          <View style={styles.steps}>
            {['Email', 'OTP', 'New Password'].map((s, i) => (
              <View key={s} style={styles.stepItem}>
                <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]}>
                  {i < stepIndex
                    ? <Ionicons name="checkmark" size={14} color={Colors.white} />
                    : <Text style={[styles.stepNum, i <= stepIndex && styles.stepNumActive]}>{i + 1}</Text>
                  }
                </View>
                <Text style={[styles.stepLabel, i <= stepIndex && styles.stepLabelActive]}>{s}</Text>
                {i < 2 && <View style={[styles.stepLine, i < stepIndex && styles.stepLineActive]} />}
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          {/* Step 1: Email */}
          {step === 'email' && (
            <>
              <Text style={styles.cardTitle}>Enter your email</Text>
              <Text style={styles.cardSub}>We'll send a 6-digit OTP to reset your password</Text>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                value={email}
                onChangeText={setEmail}
                onFocus={scrollToInput}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={Colors.textMuted}
                editable={!loading}
                accessible
                accessibilityLabel="Enter email address"
                accessibilityHint="Enter your email to receive OTP"
              />
              <TouchableOpacity 
                style={[styles.btn, (!email.trim() || !isValidEmail(email) || loading) && styles.btnDisabled]} 
                onPress={sendOtp} 
                disabled={!email.trim() || !isValidEmail(email) || loading}
                accessible
                accessibilityLabel="Send OTP"
                accessibilityRole="button"
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <>
              <Text style={styles.cardTitle}>Enter OTP</Text>
              <Text style={styles.cardSub}>Check your email {email} for the 6-digit code</Text>
              <Text style={styles.label}>6-Digit OTP</Text>
              
              {/* OTP Boxes */}
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { otpRefs.current[index] = ref; }}
                    style={[styles.otpBox, digit && styles.otpBoxFilled]}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={(e) => handleOtpKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!loading}
                    textContentType="oneTimeCode"
                    accessible
                    accessibilityLabel={`OTP digit ${index + 1}`}
                  />
                ))}
              </View>
              
              <TouchableOpacity 
                style={[styles.btn, (otp.join('').length !== 6 || loading) && styles.btnDisabled]} 
                onPress={verifyOtp} 
                disabled={otp.join('').length !== 6 || loading}
                accessible
                accessibilityLabel="Verify OTP"
                accessibilityRole="button"
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify OTP</Text>}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.resendBtn} 
                onPress={resendOtp}
                disabled={resendTimer > 0 || loading}
                accessible
                accessibilityLabel={resendTimer > 0 ? `Resend OTP in ${resendTimer} seconds` : 'Resend OTP'}
                accessibilityRole="button"
              >
                <Text style={[styles.resendText, (resendTimer > 0 || loading) && styles.resendTextDisabled]}>
                  {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Didn't receive it? Resend OTP"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Step 3: New Password */}
          {step === 'password' && (
            <>
              <Text style={styles.cardTitle}>Set New Password</Text>
              <Text style={styles.cardSub}>Choose a strong password for your account</Text>
              
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  ref={passwordRef}
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  onFocus={scrollToInput}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  placeholderTextColor={Colors.textMuted}
                  editable={!loading}
                  textContentType="newPassword"
                  accessible
                  accessibilityLabel="Enter new password"
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword((v) => !v)} 
                  style={styles.eyeBtn}
                  accessible
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  accessibilityRole="button"
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBar}>
                    {PASSWORD_RULES.map((_, i) => (
                      <View key={i} style={[styles.strengthSegment, { backgroundColor: i < passwordStrength ? strengthColor : Colors.border }]} />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strengthLabel}</Text>
                </View>
              )}

              {newPassword.length > 0 && (
                <View style={styles.rulesList}>
                  {PASSWORD_RULES.map((rule) => (
                    <View key={rule.label} style={styles.ruleRow}>
                      <Ionicons name={rule.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={rule.test(newPassword) ? Colors.success : Colors.textMuted} />
                      <Text style={[styles.ruleText, { color: rule.test(newPassword) ? Colors.success : Colors.textMuted }]}>{rule.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={[styles.label, { marginTop: 12 }]}>Confirm Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={scrollToInput}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  placeholderTextColor={Colors.textMuted}
                  editable={!loading}
                  textContentType="newPassword"
                  accessible
                  accessibilityLabel="Confirm new password"
                />
                <TouchableOpacity 
                  onPress={() => setShowConfirmPassword((v) => !v)} 
                  style={styles.eyeBtn}
                  accessible
                  accessibilityLabel={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  accessibilityRole="button"
                >
                  <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                  <Text style={styles.errorText}>Passwords do not match</Text>
                </View>
              )}

              {confirmPassword.length > 0 && newPassword === confirmPassword && (
                <View style={styles.successRow}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                  <Text style={styles.successText}>Passwords match</Text>
                </View>
              )}

              <TouchableOpacity 
                style={[styles.btn, { marginTop: 16 }, (passwordStrength < 5 || newPassword !== confirmPassword || loading) && styles.btnDisabled]} 
                onPress={resetPassword} 
                disabled={passwordStrength < 5 || newPassword !== confirmPassword || loading}
                accessible
                accessibilityLabel="Reset password"
                accessibilityRole="button"
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset Password</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <View style={styles.successContainer}>
              <Animated.View 
                style={[
                  styles.successIcon,
                  {
                    transform: [{ scale: successScale }],
                    opacity: successOpacity,
                  }
                ]}
              >
                <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
              </Animated.View>
              <Text style={styles.successTitle}>Password Reset!</Text>
              <Text style={styles.successMessage}>
                Your password has been reset successfully. Redirecting to login...
              </Text>
            </View>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  header: { alignItems: 'center', marginBottom: 24 },
  logo: { fontSize: 48 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.white, marginTop: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: Colors.white },
  stepNum: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  stepNumActive: { color: Colors.primary },
  stepLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 4, marginRight: 4 },
  stepLabelActive: { color: Colors.white, fontWeight: '700' },
  stepLine: { width: 24, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.white },
  card: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: 13, color: Colors.textMuted, marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, marginBottom: 16, backgroundColor: Colors.bg, letterSpacing: 0 },
  
  // OTP Boxes
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  otpBox: { 
    flex: 1, 
    aspectRatio: 1,
    borderWidth: 2, 
    borderColor: Colors.border, 
    borderRadius: 12, 
    fontSize: 24, 
    fontWeight: '700',
    color: Colors.text, 
    textAlign: 'center',
    backgroundColor: Colors.bg,
  },
  otpBoxFilled: { 
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.bg, marginBottom: 10 },
  passwordInput: { flex: 1, padding: 12, fontSize: 15, color: Colors.text, letterSpacing: 0 },
  eyeBtn: { paddingHorizontal: 12 },
  strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  strengthBar: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '700', width: 48, textAlign: 'right' },
  rulesList: { marginBottom: 16, gap: 5 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { fontSize: 12 },
  
  // Error and Success rows
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 10 },
  errorText: { fontSize: 12, color: Colors.danger },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 10 },
  successText: { fontSize: 12, color: Colors.success },
  
  btn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  btnDisabled: { backgroundColor: Colors.textMuted, opacity: 0.5 },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  resendBtn: { marginTop: 14, alignItems: 'center' },
  resendText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  resendTextDisabled: { color: Colors.textMuted },
  
  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  
  // Success Animation
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
