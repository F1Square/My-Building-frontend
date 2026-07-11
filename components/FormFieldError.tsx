import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

/** Inline error under a form field. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle" size={14} color={Colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/** Banner for form-level / API errors above the submit button. */
export function FormErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={styles.formErrorBanner}>
      <Ionicons name="alert-circle" size={16} color={Colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export const formFieldErrorStyles = StyleSheet.create({
  inputError: { borderColor: Colors.danger, backgroundColor: '#FEF2F2' },
});

const styles = StyleSheet.create({
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    marginTop: 2,
  },
  formErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: Colors.danger, flex: 1, fontWeight: '500' },
});
