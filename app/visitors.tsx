import React, { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Image, ToastAndroid, Linking,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useBuildings } from '../hooks/useBuildings';
import BuildingDropdown from '../components/BuildingDropdown';
import type { Building } from '../hooks/useBuildings';
import { useMarkNotificationsRead } from '../hooks/useMarkNotificationsRead';
import { cacheManager, CACHE_PRESETS } from '../utils/CacheManager';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toLocalDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function VisitorsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';

  useMarkNotificationsRead(['visitor']);
  const params = useLocalSearchParams<{ building_id?: string; building_name?: string }>();

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  useEffect(() => {
    if (params.building_id && params.building_name && isAdmin) {
      setSelectedBuilding({ id: params.building_id, name: params.building_name });
    }
  }, [params.building_id]);

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1); // 1-based
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateStr(today));
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());
  const [datesLoading, setDatesLoading] = useState(false);

  // Visitor list state
  const [visitors, setVisitors] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Detail modal
  const [detailItem, setDetailItem] = useState<any | null>(null);

  // QR Code modal state
  const [showQRShareModal, setShowQRShareModal] = useState(false);
  const [downloadingQR, setDownloadingQR] = useState(false);
  const [showUploadQRModal, setShowUploadQRModal] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [qrPhoto, setQRPhoto] = useState<string | null>(null);
  const [qrPhotoLoading, setQRPhotoLoading] = useState(false);
  const [selectedQRBuilding, setSelectedQRBuilding] = useState<Building | null>(null);

  const activeBuildingId = isAdmin ? selectedBuilding?.id : user?.building_id;

  // Fetch marked dates for current calendar month
  const fetchDates = useCallback(async () => {
    if (isAdmin && !selectedBuilding) return;
    setDatesLoading(true);
    try {
      const params: any = { month: calMonth, year: calYear };
      if (isAdmin && selectedBuilding) params.building_id = selectedBuilding.id;
      const res = await api.get('/visitors/dates', { params });
      setMarkedDates(new Set(res.data.dates));
    } catch {
      // silently fail — dots just won't show
    } finally {
      setDatesLoading(false);
    }
  }, [calMonth, calYear, selectedBuilding, isAdmin]);

  // Fetch visitors for selected date
  const fetchVisitors = useCallback(async (date: string, forceRefresh = false) => {
    if (isAdmin && !selectedBuilding) return;
    const buildingId = isAdmin ? selectedBuilding?.id : user?.building_id;
    const cacheKey = cacheManager.generateKey('visitors', '/visitors', { date, building_id: buildingId }, user?.role, buildingId);

    if (!forceRefresh) {
      const cached = await cacheManager.get<any[]>(cacheKey, CACHE_PRESETS.userSpecific);
      if (cached) { setVisitors(cached); setListLoading(false); }
    }

    setListLoading(true);
    try {
      const params: any = { date };
      if (isAdmin && selectedBuilding) params.building_id = selectedBuilding.id;
      const res = await api.get('/visitors', { params });
      await cacheManager.set(cacheKey, res.data, CACHE_PRESETS.userSpecific);
      setVisitors(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load visitors');
    } finally {
      setListLoading(false);
      setRefreshing(false);
    }
  }, [selectedBuilding, isAdmin, user?.role, user?.building_id]);

  useEffect(() => { fetchDates(); }, [fetchDates]);
  useEffect(() => { fetchVisitors(selectedDate); }, [selectedDate, fetchVisitors]);

  // Fetch QR photo for building
  const fetchQRPhoto = useCallback(async (buildingId: string) => {
    if (!buildingId) return;
    setQRPhotoLoading(true);
    try {
      const res = await api.get(`/qr-photos/building/${buildingId}`);
      setQRPhoto(res.data.photo_url);
    } catch (e: any) {
      setQRPhoto(null);
    } finally {
      setQRPhotoLoading(false);
    }
  }, []);

  // Auto-fetch QR photo when viewing
  useEffect(() => {
    if (activeBuildingId) {
      fetchQRPhoto(activeBuildingId);
    }
  }, [activeBuildingId, fetchQRPhoto]);

  // Admin: Upload QR photo
  const handleUploadQRPhoto = async () => {
    if (!selectedQRBuilding) {
      Alert.alert('Error', 'Please select a society first');
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

      setUploadingQR(true);

      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: `qr-photo-${Date.now()}.jpg`,
      } as any);

      const res = await api.post(`/qr-photos/${selectedQRBuilding.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setQRPhoto(res.data.photo_url);
      setShowUploadQRModal(false);
      ToastAndroid.show('QR photo uploaded successfully', ToastAndroid.SHORT);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to upload QR photo';
      Alert.alert('Upload Error', errorMsg);
    } finally {
      setUploadingQR(false);
    }
  };

  // Share QR photo
  const shareQR = async () => {
    if (!qrPhoto) {
      Alert.alert('No QR Photo', 'No QR photo uploaded for this society');
      return;
    }
    setShowQRShareModal(true);
  };

  const downloadQR = async () => {
    if (!qrPhoto) {
      ToastAndroid.show('No QR photo available', ToastAndroid.SHORT);
      return;
    }
    
    setDownloadingQR(true);
    try {
      const fileName = `visitor-qr-${Date.now()}.jpg`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Download QR image from Cloudinary
      const downloadResult = await FileSystem.downloadAsync(qrPhoto, fileUri);
      
      if (downloadResult.status === 200) {
        await Sharing.shareAsync(fileUri, { 
          mimeType: 'image/jpeg',
          dialogTitle: 'Save QR Code'
        });
        ToastAndroid.show('QR code saved', ToastAndroid.SHORT);
      } else {
        throw new Error('Download failed');
      }
    } catch (error: any) {
      console.error('Download error:', error);
      ToastAndroid.show('Failed to download QR code', ToastAndroid.LONG);
    } finally {
      setDownloadingQR(false);
    }
  };

  const shareQRWhatsApp = async () => {
    if (!qrPhoto) {
      ToastAndroid.show('No QR photo available', ToastAndroid.SHORT);
      return;
    }
    
    setDownloadingQR(true);
    try {
      const fileName = `visitor-qr-${Date.now()}.jpg`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Download QR image from Cloudinary to local storage
      const downloadResult = await FileSystem.downloadAsync(qrPhoto, fileUri);
      
      if (downloadResult.status !== 200) {
        throw new Error('Failed to download QR photo');
      }

      // Share image via WhatsApp with message
      const message = 'Scan this QR code to register visitor entry';
      
      // Check if WhatsApp is installed
      const whatsappUrl = 'whatsapp://send';
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      
      if (!canOpen) {
        // WhatsApp not installed, use generic share
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/jpeg',
          dialogTitle: message,
        });
      } else {
        // Share via native share sheet (will show WhatsApp option)
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/jpeg',
          dialogTitle: message,
        });
      }
      
      setShowQRShareModal(false);
      ToastAndroid.show('Shared successfully', ToastAndroid.SHORT);
    } catch (error: any) {
      console.error('WhatsApp share error:', error);
      ToastAndroid.show('Failed to share QR code', ToastAndroid.LONG);
    } finally {
      setDownloadingQR(false);
    }
  };

  // Calendar navigation functions
  const prevMonth = () => {
    setCalMonth(calMonth === 1 ? 12 : calMonth - 1);
    if (calMonth === 1) setCalYear(calYear - 1);
  };

  const nextMonth = () => {
    setCalMonth(calMonth === 12 ? 1 : calMonth + 1);
    if (calMonth === 12) setCalYear(calYear + 1);
  };

  // Build calendar grid
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (calCells.length % 7 !== 0) calCells.push(null);

  // Record QR share action (fire-and-forget, doesn't block UI)
  const recordQRShare = (shareMethod: string) => {
    if (!activeBuildingId) return;
    
    // Fire and forget - don't wait for response
    api.post(`/qr-photos/${activeBuildingId}/share`, {
      share_method: shareMethod
    }).catch(() => {}); // Silently fail, non-critical
  };

  const renderCalendar = () => (
    <View style={styles.calendarCard}>
      {/* Month navigation */}
      <View style={styles.calNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.calMonthLabel}>{MONTHS[calMonth - 1]} {calYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.calRow}>
        {DAYS.map((d) => (
          <Text key={d} style={styles.calDayHeader}>{d}</Text>
        ))}
      </View>

      {/* Date cells */}
      {Array.from({ length: calCells.length / 7 }, (_, row) => (
        <View key={row} style={styles.calRow}>
          {calCells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={styles.calCell} />;
            const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === toLocalDateStr(today);
            const hasVisitors = markedDates.has(dateStr);
            return (
              <TouchableOpacity
                key={col}
                style={[styles.calCell, isSelected && styles.calCellSelected, isToday && !isSelected && styles.calCellToday]}
                onPress={() => setSelectedDate(dateStr)}
              >
                <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected, isToday && !isSelected && styles.calDayTextToday]}>
                  {day}
                </Text>
                {hasVisitors && <View style={[styles.calDot, isSelected && styles.calDotSelected]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  const renderVisitorItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => setDetailItem(item)} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardMeta}>{item.phone}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={styles.cardTime}>
            {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </View>
      </View>
      <View style={styles.cardDetails}>
        {item.flat_no ? (
          <View style={styles.detailRow}>
            <Ionicons name="home-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.detailText}>Flat {item.flat_no}</Text>
          </View>
        ) : null}
        {item.purpose || item.work_detail ? (
          <View style={styles.detailRow}>
            <Ionicons name="briefcase-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.detailText}>{item.purpose || item.work_detail}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const formattedSelected = (() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  })();

  

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('visitors')}</Text>
        <View style={styles.headerActions}>
          {isAdmin && (
            <TouchableOpacity 
              style={styles.headerActionBtn}
              onPress={() => setShowUploadQRModal(true)}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={Colors.white} />
              <Text style={styles.headerActionBtnText}>Upload</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.headerActionBtn, { marginLeft: isAdmin ? 8 : 0 }]}
            onPress={shareQR}
          >
            <Ionicons name="share-social-outline" size={18} color={Colors.white} />
            <Text style={styles.headerActionBtnText}>Share QR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Admin building filter */}
      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown
            buildings={buildings}
            loading={buildingsLoading}
            selected={selectedBuilding}
            onSelect={(b) => { setSelectedBuilding(b); setMarkedDates(new Set()); setVisitors([]); }}
            label="Select Building"
          />
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await cacheManager.invalidate('visitors:*');
          fetchVisitors(selectedDate, true);
          fetchDates();
        }} />}
      >
        {/* Calendar */}
        {renderCalendar()}

        {/* Selected date header */}
        <View style={styles.dateHeader}>
          <Ionicons name="calendar" size={15} color={Colors.primary} />
          <Text style={styles.dateHeaderText}>{formattedSelected}</Text>
          {datesLoading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
        </View>

        {/* Visitor list */}
        {listLoading ? (
          <ActivityIndicator style={{ marginTop: 32 }} size="large" color={Colors.primary} />
        ) : visitors.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={40} color={Colors.border} />
            <Text style={styles.empty}>
              {isAdmin && !selectedBuilding ? t('selectBuildingToView') : t('noVisitors')}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            {visitors.map((item) => (
              <View key={item.id}>
                {renderVisitorItem({ item })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!detailItem} transparent animationType="slide" onRequestClose={() => setDetailItem(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailItem(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Visitor photo */}
            {detailItem?.photo_url ? (
              <Image
                source={{ uri: detailItem.photo_url }}
                style={styles.modalPhoto}
                resizeMode="cover"
              />
            ) : null}

            <View style={styles.modalAvatarRow}>
              {!detailItem?.photo_url && (
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>{detailItem?.name?.[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.modalName}>{detailItem?.name}</Text>
                <Text style={styles.modalSub}>Visitor Details</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close-circle" size={28} color={Colors.border} />
              </TouchableOpacity>
            </View>

            {[
              { icon: 'call-outline', label: 'Phone', value: detailItem?.phone },
              { icon: 'home-outline', label: 'Flat No.', value: detailItem?.flat_no },
              { icon: 'briefcase-outline', label: 'Purpose', value: detailItem?.purpose || detailItem?.work_detail },
              { icon: 'calendar-outline', label: 'Date', value: detailItem ? new Date(detailItem.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '' },
              { icon: 'time-outline', label: 'Time', value: detailItem ? new Date(detailItem.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '' },
            ].filter((r) => r.value).map((row) => (
              <View key={row.label} style={styles.modalRow}>
                <View style={styles.modalRowIcon}>
                  <Ionicons name={row.icon as any} size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalRowLabel}>{row.label}</Text>
                  <Text style={styles.modalRowValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* QR Code Share Modal */}
      <Modal visible={showQRShareModal} transparent animationType="fade" onRequestClose={() => setShowQRShareModal(false)}>
        <TouchableOpacity style={styles.qrModalOverlay} activeOpacity={1} onPress={() => setShowQRShareModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Visitor Entry QR Code</Text>
              <TouchableOpacity onPress={() => setShowQRShareModal(false)} style={styles.qrCloseBtn}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {qrPhotoLoading ? (
              <View style={[styles.qrImage, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : qrPhoto ? (
              <Image
                source={{ uri: qrPhoto }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.qrImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg }]}>
                <Ionicons name="image-outline" size={48} color={Colors.border} />
                <Text style={{ color: Colors.textMuted, marginTop: 12, fontSize: 14 }}>No QR photo available</Text>
              </View>
            )}

            <Text style={styles.qrCodeText}>
              {qrPhoto 
                ? 'Share this QR code for visitor registration' 
                : 'QR photo not uploaded yet'}
            </Text>

            <View style={styles.qrActionContainer}>
              <TouchableOpacity
                style={[styles.qrActionBtnWhatsApp, !qrPhoto && { opacity: 0.5 }]}
                onPress={() => {
                  recordQRShare('whatsapp');
                  shareQRWhatsApp();
                }}
                disabled={downloadingQR || !qrPhoto}
              >
                <Ionicons name="logo-whatsapp" size={20} color={Colors.white} />
                <Text style={styles.qrActionBtnText}>Share on WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.qrActionBtnDownload, !qrPhoto && { opacity: 0.5 }]}
                onPress={() => {
                  recordQRShare('download');
                  downloadQR();
                }}
                disabled={downloadingQR || !qrPhoto}
              >
                {downloadingQR ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons name="download-outline" size={20} color={Colors.primary} />
                )}
                <Text style={styles.qrActionBtnTextDownload}>
                  {downloadingQR ? 'Downloading...' : 'Download'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Upload QR Photo Modal (Admin Only) */}
      <Modal visible={showUploadQRModal} transparent animationType="slide" onRequestClose={() => setShowUploadQRModal(false)}>
        <View style={styles.uploadModalOverlay}>
          <View style={styles.uploadModalContent}>
            <View style={styles.uploadModalHeader}>
              <Text style={styles.uploadModalTitle}>Upload QR Photo</Text>
              <TouchableOpacity onPress={() => setShowUploadQRModal(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.uploadModalBody} showsVerticalScrollIndicator={false}>
              {/* Building Selection */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 12 }}>Select Society</Text>
                <BuildingDropdown
                  buildings={buildings}
                  loading={buildingsLoading}
                  selected={selectedQRBuilding}
                  onSelect={(b) => {
                    if (b) {
                      setSelectedQRBuilding(b);
                      if (activeBuildingId !== b.id) {
                        fetchQRPhoto(b.id);
                      }
                    }
                  }}
                  label="Choose a society"
                />
              </View>

              {/* Upload Icon */}
              <View style={styles.uploadIconContainer}>
                <Ionicons name="image-outline" size={48} color={Colors.primary} />
              </View>

              <Text style={styles.uploadModalDesc}>
                Upload a QR code photo for this society
              </Text>

              {/* Current QR Photo (if exists) */}
              {qrPhoto && (
                <View style={styles.currentQRSection}>
                  <Text style={styles.currentQRLabel}>Current QR Photo:</Text>
                  <Image
                    source={{ uri: qrPhoto }}
                    style={styles.currentQRPreview}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* Upload Button */}
              <TouchableOpacity
                style={[styles.uploadPhotoBtn, (uploadingQR || !selectedQRBuilding) && styles.uploadPhotoBtnDisabled]}
                onPress={handleUploadQRPhoto}
                disabled={uploadingQR || !selectedQRBuilding}
              >
                {uploadingQR ? (
                  <ActivityIndicator size="large" color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={24} color={Colors.white} />
                    <Text style={styles.uploadPhotoBtnText}>Choose Photo</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.uploadHint}>
                • Square format recommended{'\n'}
                • JPEG, PNG or WebP{'\n'}
                • Max 10MB
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 20, fontWeight: '800', flex: 1, marginLeft: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  headerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  headerActionBtnText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },

  // Calendar
  calendarCard: { backgroundColor: Colors.white, margin: 16, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: { padding: 6 },
  calMonthLabel: { fontSize: 16, fontWeight: '800', color: Colors.text },
  calRow: { flexDirection: 'row' },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted, paddingVertical: 4 },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, margin: 1 },
  calCellSelected: { backgroundColor: Colors.primary },
  calCellToday: { backgroundColor: Colors.primary + '15' },
  calDayText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  calDayTextSelected: { color: Colors.white, fontWeight: '800' },
  calDayTextToday: { color: Colors.primary, fontWeight: '800' },
  calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent, marginTop: 2 },
  calDotSelected: { backgroundColor: Colors.white },

  // Date header
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 10 },
  dateHeaderText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Visitor cards
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textMuted },
  cardTime: { fontSize: 12, color: Colors.textMuted },
  cardDetails: { gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: Colors.textMuted },
  emptyBox: { alignItems: 'center', paddingTop: 48, gap: 10 },
  empty: { textAlign: 'center', color: Colors.textMuted, fontSize: 15 },

  // Detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  modalPhoto: { width: '100%', height: 200, borderRadius: 14, marginBottom: 16 },
  modalAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  modalAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  modalAvatarText: { fontSize: 24, fontWeight: '800', color: Colors.primary },
  modalName: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalRowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },
  modalRowLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalRowValue: { fontSize: 15, fontWeight: '600', color: Colors.text, marginTop: 1 },

  // QR Code Modal
  qrModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  qrModalContent: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, width: '87%', maxWidth: 340, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 },
  qrModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  qrModalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  qrImage: { width: '100%', height: 260, borderRadius: 14, backgroundColor: Colors.bg, marginBottom: 18 },
  qrCodeText: { textAlign: 'center', fontSize: 14, fontWeight: '600', color: Colors.textMuted, marginBottom: 20 },
  qrActionContainer: { gap: 10 },
  qrActionBtnWhatsApp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 11, backgroundColor: '#25D366', shadowColor: '#25D366', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  qrActionBtnDownload: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 11, backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.primary },
  qrActionBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  qrActionBtnTextDownload: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  qrCloseBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: Colors.bg },

  // Upload QR Modal
  uploadModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  uploadModalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingBottom: 32, maxHeight: '90%' },
  uploadModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  uploadModalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  uploadModalBody: { paddingHorizontal: 20, paddingTop: 20 },
  uploadModalDesc: { textAlign: 'center', fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 20 },
  uploadIconContainer: { alignItems: 'center', marginBottom: 16 },
  currentQRSection: { backgroundColor: Colors.bg, borderRadius: 12, padding: 16, marginBottom: 20, alignItems: 'center' },
  currentQRLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  currentQRPreview: { width: 140, height: 140, borderRadius: 12, backgroundColor: Colors.white },
  uploadPhotoBtn: { width: '100%', backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginBottom: 16 },
  uploadPhotoBtnDisabled: { opacity: 0.6 },
  uploadPhotoBtnText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  uploadHint: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', fontWeight: '500', lineHeight: 20 },
});
