import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Colors } from '../constants/colors';
import { ArrowUpCircle } from 'lucide-react-native';

interface UpdateModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function UpdateModal({ visible, onClose }: UpdateModalProps) {
  const handleUpdate = () => {
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.f1square.mybuilding';
    const appStoreUrl = 'https://apps.apple.com/app/my-building'; // Update with real ID if available
    
    const url = Platform.OS === 'android' ? playStoreUrl : appStoreUrl;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      }
    });
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            <ArrowUpCircle size={50} color={Colors.primary} />
          </View>
          
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.message}>
            A new version of My Building is available. Please update the app to continue enjoying our latest features and improvements.
          </Text>
          
          <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 30,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  iconContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
    padding: 15,
    borderRadius: 25,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  updateButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  updateButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    paddingVertical: 12,
  },
  closeButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
});
