/**
 * Test component to verify alert patch is working
 * Use this to test the modern alert system
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert as RNAlert, ToastAndroid } from 'react-native';
import { ModernAlert } from './modernAlert';
import { ToastCompat } from './toastCompat';

export default function AlertPatchTest() {
  const testNativeAlert = () => {
    RNAlert.alert('Native Alert Test', 'This should show as a toast notification');
  };

  const testNativeAlertWithButtons = () => {
    RNAlert.alert(
      'Confirmation Test',
      'This should show as a native alert with buttons',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: () => console.log('OK pressed') },
      ]
    );
  };

  const testToastAndroid = () => {
    ToastAndroid.show('ToastAndroid Test', ToastAndroid.SHORT);
  };

  const testToastAndroidLong = () => {
    ToastAndroid.show('ToastAndroid Long Test', ToastAndroid.LONG);
  };

  const testModernAlertSuccess = () => {
    ModernAlert.success('Success', 'Operation completed successfully');
  };

  const testModernAlertError = () => {
    ModernAlert.error('Error', 'Something went wrong');
  };

  const testModernAlertWarning = () => {
    ModernAlert.warning('Warning', 'This is a warning message');
  };

  const testModernAlertInfo = () => {
    ModernAlert.info('Info', 'This is an information message');
  };

  const testModernAlertConfirm = async () => {
    const result = await ModernAlert.confirm('Delete', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive' },
    ]);
    console.log('Confirmation result:', result);
  };

  const testToastCompat = () => {
    ToastCompat.success('Success via ToastCompat');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alert Patch Test</Text>
      
      <TouchableOpacity style={styles.button} onPress={testNativeAlert}>
        <Text style={styles.buttonText}>Test Native Alert (Toast)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testNativeAlertWithButtons}>
        <Text style={styles.buttonText}>Test Native Alert with Buttons</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testToastAndroid}>
        <Text style={styles.buttonText}>Test ToastAndroid (Short)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testToastAndroidLong}>
        <Text style={styles.buttonText}>Test ToastAndroid (Long)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.successButton]} onPress={testModernAlertSuccess}>
        <Text style={styles.buttonText}>Test ModernAlert Success</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.errorButton]} onPress={testModernAlertError}>
        <Text style={styles.buttonText}>Test ModernAlert Error</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={testModernAlertWarning}>
        <Text style={styles.buttonText}>Test ModernAlert Warning</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={testModernAlertInfo}>
        <Text style={styles.buttonText}>Test ModernAlert Info</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={testModernAlertConfirm}>
        <Text style={styles.buttonText}>Test ModernAlert Confirm</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.successButton]} onPress={testToastCompat}>
        <Text style={styles.buttonText}>Test ToastCompat Success</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        Note: All Alert.alert calls without buttons should show as toast notifications.
        Alert.alert calls with buttons should show as native alerts.
        ToastAndroid calls should show as toast notifications.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  successButton: {
    backgroundColor: '#34C759',
  },
  errorButton: {
    backgroundColor: '#FF3B30',
  },
  warningButton: {
    backgroundColor: '#FF9500',
  },
  infoButton: {
    backgroundColor: '#5AC8FA',
  },
  confirmButton: {
    backgroundColor: '#5856D6',
  },
  note: {
    marginTop: 20,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});