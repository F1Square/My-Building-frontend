import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ToastAndroid,
  Modal,
  ScrollView,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import api from '../utils/api';
import { Colors } from '../constants/colors';

interface QRPhoto {
  id: string;
  photo_url: string;
  created_at: string;
  uploaded_by?: string;
}

interface Props {
  building_id: string;
  userRole: string;
  onSuccess?: () => void;
}

export default function QRPhotoManager({ building_id, userRole, onSuccess }: Props) {
  const [qrPhoto, setQRPhoto] = useState<QRPhoto | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  const isAdmin = userRole === 'admin';
  const canManage = isAdmin || userRole === 'pramukh';

  useEffect(() => {
    fetchQRPhoto();
    if (canManage) fetchAnalytics();
  }, [building_id]);

  const fetchQRPhoto = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/qr-photos/building/${building_id}`);
      setQRPhoto(res.data);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Failed to fetch QR photo:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await api.get(`/qr-photos/${building_id}/analytics`);
      setAnalytics(res.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleUploadPhoto = async () => {
    if (!isAdmin) {
      Alert.error('Access Denied', 'Only admins can upload QR photos', 4000);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset.uri) return;

      setUploading(true);

      // Create FormData
      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: `qr-photo-${Date.now()}.jpg`,
      } as any);

      const res = await api.post(`/qr-photos/${building_id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setQRPhoto(res.data.qr_photo);
      ToastAndroid.show('QR photo uploaded successfully', ToastAndroid.SHORT);
      onSuccess?.();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to upload QR photo';
      Alert.error('Upload Error', errorMsg, 4000);
    } finally {
      setUploading(false);
    }
  };

  const recordShare = async (method: 'whatsapp' | 'download' | 'email') => {
    if (!qrPhoto) return;

    try {
      await api.post(`/qr-photos/${qrPhoto.id}/share`, { share_method: method });

      // Show success toast
      const methodName = method === 'whatsapp' ? 'WhatsApp' : method === 'download' ? 'Download' : 'Email';
      ToastAndroid.show(`Shared via ${methodName}`, ToastAndroid.SHORT);

      // Refresh analytics
      if (canManage) fetchAnalytics();
    } catch (error) {
      console.error('Failed to record share:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="qr-code" size={24} color={Colors.primary} />
        <Text style={styles.headerTitle}>Visitor Entry QR</Text>
        {canManage && (
          <TouchableOpacity onPress={() => setShowModal(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Main content */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 32 }} />
      ) : qrPhoto ? (
        <View style={styles.photoContainer}>
          {/* Photo preview */}
          <Image
            source={{ uri: qrPhoto.photo_url }}
            style={styles.photo}
            resizeMode="cover"
          />

          <Text style={styles.uploadedDate}>
            {new Date(qrPhoto.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#25D366' }]}
              onPress={() => recordShare('whatsapp')}
            >
              <Ionicons name="logo-whatsapp" size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>Share WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
              onPress={() => recordShare('download')}
            >
              <Ionicons name="download" size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>Download</Text>
            </TouchableOpacity>
          </View>

          {/* Analytics for admins/pramukhs */}
          {canManage && analytics && (
            <View style={styles.analyticsBox}>
              <Text style={styles.analyticsTitle}>Share Analytics</Text>
              <View style={styles.analyticsStat}>
                <Text style={styles.statsLabel}>Total Shares:</Text>
                <Text style={styles.statsValue}>{analytics.total_shares}</Text>
              </View>
              <View style={styles.analyticsRow}>
                <View style={styles.statsMethod}>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={styles.statsLabel}>WhatsApp:</Text>
                  <Text style={styles.statsValue}>{analytics.by_method.whatsapp}</Text>
                </View>
                <View style={styles.statsMethod}>
                  <Ionicons name="download" size={16} color={Colors.primary} />
                  <Text style={styles.statsLabel}>Downloads:</Text>
                  <Text style={styles.statsValue}>{analytics.by_method.download}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="image-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyText}>No QR photo uploaded yet</Text>
          {isAdmin && (
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={handleUploadPhoto}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={16} color={Colors.white} />
                  <Text style={styles.uploadBtnText}>Upload QR Photo</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Admin menu modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.menuPopup}>
            {isAdmin && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowModal(false);
                  handleUploadPhoto();
                }}
                disabled={uploading}
              >
                <Ionicons name="cloud-upload" size={18} color={Colors.primary} />
                <Text style={styles.menuItemText}>
                  {uploading ? 'Uploading...' : 'Update QR Photo'}
                </Text>
              </TouchableOpacity>
            )}

            {qrPhoto && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowModal(false);
                  recordShare('email');
                }}
              >
                <Ionicons name="mail" size={18} color={Colors.primary} />
                <Text style={styles.menuItemText}>Share via Email</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  photoContainer: {
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  uploadedDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
  },
  actionBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  analyticsBox: {
    backgroundColor: Colors.bg,
    borderRadius: 10,
    padding: 12,
    width: '100%',
  },
  analyticsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  analyticsStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 10,
  },
  analyticsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statsMethod: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  statsLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 12,
    marginBottom: 16,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  uploadBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuPopup: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
});
