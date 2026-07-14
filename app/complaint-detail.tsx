import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Image, TextInput, ActivityIndicator, Pressable } from 'react-native';
import { Alert } from '../utils/alert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useActivityLog } from '../hooks/useActivityLog';
import * as ImagePicker from 'expo-image-picker';
import api from '../utils/api';
import { ModuleHeader } from '../components/ModuleHeader';
import { uploadComplaintPhoto } from '../utils/uploadComplaintPhoto';
import { cacheManager } from '../utils/CacheManager';

const CATEGORIES = ['General', 'Water', 'Electricity', 'Cleanliness', 'Security', 'Parking', 'Noise', 'Other'];
const CAT_ICONS: Record<string, string> = {
  General: 'alert-circle-outline', Water: 'water-outline',
  Electricity: 'flash-outline', Cleanliness: 'trash-outline',
  Security: 'shield-outline', Parking: 'car-outline',
  Noise: 'volume-high-outline', Other: 'ellipsis-horizontal-circle-outline',
};
const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  open: { label: 'Open', color: '#EF4444', bg: '#FEF2F2', icon: 'alert-circle' },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB', icon: 'time' },
  resolved: { label: 'Resolved', color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle' },
};

export default function ComplaintDetailScreen() {
  const { id, isAdminStr, isSocietyViewStr, showUpdateBtnStr } = useLocalSearchParams<{
    id?: string;
    isAdminStr?: string;
    isSocietyViewStr?: string;
    showUpdateBtnStr?: string;
  }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { logEvent } = useActivityLog();

  const isAdmin = isAdminStr === 'true';
  const isSocietyView = isSocietyViewStr === 'true';
  const showUpdateButton = showUpdateBtnStr === 'true';

  const [detailItem, setDetailItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageViewerUri, setImageViewerUri] = useState<string | null>(null);

  const [showUpdate, setShowUpdate] = useState(false);
  const [updateForm, setUpdateForm] = useState({ status: 'open', remark: '' });
  const [updating, setUpdating] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '', description: '', category: 'General', status: 'open', remark: '', photo_url: '',
  });
  const [editImageUri, setEditImageUri] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setLoadError('Complaint not found');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    api.get(`/complaints/${id}`)
      .then((res) => {
        if (cancelled) return;
        const item = res.data;
        setDetailItem(item);
        setUpdateForm({ status: item.status || 'open', remark: item.remark || '' });
        setEditForm({
          title: item.title || '',
          description: item.description || '',
          category: item.category || 'General',
          status: item.status || 'open',
          remark: item.remark || '',
          photo_url: item.photo_url || '',
        });
        setEditImageUri(item.photo_url || null);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setLoadError(e.response?.data?.error || 'Failed to load complaint');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.6 });
    if (!result.canceled && result.assets[0]) {
      setEditImageUri(result.assets[0].uri);
      setEditForm(f => ({
        ...f,
        photo_url: result.assets[0].base64
          ? `data:image/jpeg;base64,${result.assets[0].base64}`
          : f.photo_url,
      }));
    }
  };

  const submitUpdate = async () => {
    if (!detailItem) return;
    setUpdating(true);
    try {
      await api.patch(`/complaints/${detailItem.id}/status`, updateForm);
      logEvent('complaint_status_updated', 'complaints', { complaint_id: detailItem.id, new_status: updateForm.status });
      setShowUpdate(false);
      setDetailItem({ ...detailItem, status: updateForm.status, remark: updateForm.remark });
      await cacheManager.invalidate('complaints:*');
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed to update', 4000);
    } finally { setUpdating(false); }
  };

  const submitEdit = async () => {
    if (!detailItem) return;
    setUpdating(true);
    try {
      let photo_url = editForm.photo_url;
      if (editImageUri && !editImageUri.startsWith('http')) {
        try {
          photo_url = (await uploadComplaintPhoto(editImageUri)) || photo_url;
        } catch {
          // keep data-URI fallback in editForm.photo_url for server-side upload
        }
      }
      await api.put(`/complaints/admin/${detailItem.id}`, { ...editForm, photo_url });
      setShowEdit(false);
      await cacheManager.invalidate('complaints:*');
      setDetailItem({ ...detailItem, ...editForm, photo_url });
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed to update', 4000);
    } finally { setUpdating(false); }
  };

  const deleteComplaint = () => {
    if (!detailItem) return;
    Alert.alert('Delete Complaint', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/complaints/admin/${detailItem.id}`);
            await cacheManager.invalidate('complaints:*');
            router.back();
          } catch (e: any) { Alert.error('Error', e.response?.data?.error || 'Failed', 4000); }
        },
      },
    ]);
  };

  const renderHeader = () => (
    <ModuleHeader title="Complaint Detail" />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading complaint...</Text>
        </View>
      </View>
    );
  }

  if (loadError || !detailItem) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>{loadError || 'Complaint not found'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const meta = STATUS_META[detailItem.status] || STATUS_META.open;

  return (
    <View style={styles.container}>
      {renderHeader()}

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.color + '50' }]}>
          <Ionicons name={meta.icon as any} size={16} color={meta.color} />
          <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        <Text style={styles.detailTitle}>{detailItem.title}</Text>

        <View style={styles.detailMetaRow}>
          <View style={styles.detailMetaItem}>
            <Ionicons name="pricetag-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.detailMetaText}>{detailItem.category || 'General'}</Text>
          </View>
          <View style={styles.detailMetaItem}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.detailMetaText}>
              {new Date(detailItem.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {isSocietyView || isAdmin ? (
          <View style={styles.detailInfoRow}>
            {isAdmin && (
              <View style={styles.detailInfoCard}>
                <Ionicons name="business-outline" size={16} color={Colors.primary} />
                <Text style={styles.detailInfoText}>{detailItem.buildings?.name || '—'}</Text>
              </View>
            )}
            {detailItem.users ? (
              <View style={styles.detailInfoCard}>
                <View style={styles.residentAvatar}>
                  <Text style={styles.residentAvatarText}>{detailItem.users.name?.[0]?.toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.detailInfoText}>{detailItem.users.name}</Text>
                  {detailItem.users.flat_no ? <Text style={styles.detailInfoSub}>Flat {detailItem.users.flat_no}</Text> : null}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {detailItem.description ? (
          <View style={styles.detailBlock}>
            <Text style={styles.detailBlockLabel}>Description</Text>
            <Text style={styles.detailBlockText}>{detailItem.description}</Text>
          </View>
        ) : null}

        {detailItem.photo_url ? (
          <View style={styles.detailBlock}>
            <Text style={styles.detailBlockLabel}>Attachment</Text>
            <Pressable onPress={() => setImageViewerUri(detailItem.photo_url)}>
              <Image source={{ uri: detailItem.photo_url }} style={styles.detailPhoto} resizeMode="cover" />
              <Text style={styles.tapToExpand}>Tap to expand</Text>
            </Pressable>
          </View>
        ) : null}

        {detailItem.remark ? (
          <View style={[styles.detailBlock, { backgroundColor: meta.bg, borderLeftWidth: 3, borderLeftColor: meta.color }]}>
            <Text style={[styles.detailBlockLabel, { color: meta.color }]}>Remark</Text>
            <Text style={styles.detailBlockText}>{detailItem.remark}</Text>
          </View>
        ) : null}

        {isAdmin ? (
          <View style={styles.detailActions}>
            <TouchableOpacity style={[styles.detailActionBtn, { backgroundColor: Colors.primary }]} onPress={() => setShowEdit(true)}>
              <Ionicons name="create-outline" size={18} color={Colors.white} />
              <Text style={styles.detailActionText}>{t('edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.detailActionBtn, { backgroundColor: Colors.danger }]} onPress={deleteComplaint}>
              <Ionicons name="trash-outline" size={18} color={Colors.white} />
              <Text style={styles.detailActionText}>{t('delete')}</Text>
            </TouchableOpacity>
          </View>
        ) : showUpdateButton ? (
          <TouchableOpacity style={styles.submitBtn} onPress={() => setShowUpdate(true)}>
            <Ionicons name="create-outline" size={18} color={Colors.white} />
            <Text style={styles.submitBtnText}>Update Status</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={!!imageViewerUri} transparent animationType="fade" onRequestClose={() => setImageViewerUri(null)}>
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setImageViewerUri(null)}>
            <Ionicons name="close-circle" size={36} color={Colors.white} />
          </TouchableOpacity>
          {imageViewerUri && <Image source={{ uri: imageViewerUri }} style={styles.imageViewerImg} resizeMode="contain" />}
        </View>
      </Modal>

      <Modal visible={showUpdate} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '65%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Update Status</Text>
              <TouchableOpacity onPress={() => setShowUpdate(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Set Status</Text>
              <View style={styles.statusGrid}>
                {(['open', 'in_progress', 'resolved'] as const).map(s => {
                  const m = STATUS_META[s];
                  const active = updateForm.status === s;
                  return (
                    <TouchableOpacity key={s} style={[styles.statusTile, active && { backgroundColor: m.color, borderColor: m.color }]} onPress={() => setUpdateForm(f => ({ ...f, status: s }))}>
                      <Ionicons name={m.icon as any} size={22} color={active ? '#fff' : m.color} />
                      <Text style={[styles.statusTileText, active && { color: '#fff' }]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.label}>Remark (optional)</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Add a resolution note or remark..." value={updateForm.remark} onChangeText={t => setUpdateForm(f => ({ ...f, remark: t }))} multiline numberOfLines={3} placeholderTextColor={Colors.textMuted} />
              <TouchableOpacity style={[styles.submitBtn, updating && { opacity: 0.6 }]} onPress={submitUpdate} disabled={updating}>
                {updating ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitBtnText}>{t('saveChanges')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Edit Complaint</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={editForm.title} onChangeText={t => setEditForm(f => ({ ...f, title: t }))} placeholderTextColor={Colors.textMuted} />
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity key={cat} style={[styles.chip, editForm.category === cat && styles.chipActive]} onPress={() => setEditForm(f => ({ ...f, category: cat }))}>
                      <Ionicons name={CAT_ICONS[cat] as any} size={13} color={editForm.category === cat ? Colors.white : Colors.textMuted} />
                      <Text style={[styles.chipText, editForm.category === cat && styles.chipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} value={editForm.description} onChangeText={t => setEditForm(f => ({ ...f, description: t }))} multiline numberOfLines={3} placeholderTextColor={Colors.textMuted} />
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusGrid}>
                {(['open', 'in_progress', 'resolved'] as const).map(s => {
                  const m = STATUS_META[s];
                  const active = editForm.status === s;
                  return (
                    <TouchableOpacity key={s} style={[styles.statusTile, active && { backgroundColor: m.color, borderColor: m.color }]} onPress={() => setEditForm(f => ({ ...f, status: s }))}>
                      <Ionicons name={m.icon as any} size={20} color={active ? '#fff' : m.color} />
                      <Text style={[styles.statusTileText, active && { color: '#fff' }]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.label}>Remark</Text>
              <TextInput style={[styles.input, styles.textArea]} value={editForm.remark} onChangeText={t => setEditForm(f => ({ ...f, remark: t }))} multiline numberOfLines={3} placeholder="Add remark..." placeholderTextColor={Colors.textMuted} />
              <Text style={styles.label}>Photo</Text>
              <TouchableOpacity style={styles.photoPicker} onPress={pickImage}>
                {editImageUri ? <Image source={{ uri: editImageUri }} style={styles.photoPreview} /> : <View style={styles.photoPlaceholder}><Ionicons name="image-outline" size={30} color={Colors.textMuted} /><Text style={styles.photoPlaceholderText}>Tap to change photo</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, updating && { opacity: 0.6 }]} onPress={submitEdit} disabled={updating}>
                {updating ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitBtnText}>{t('saveChanges')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 54, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.white },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 14 },
  loadingText: { fontSize: 15, color: Colors.textMuted, fontWeight: '600' },
  errorText: { fontSize: 16, color: Colors.text, fontWeight: '600', textAlign: 'center' },
  retryBtn: { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, marginBottom: 14 },
  statusPillText: { fontSize: 14, fontWeight: '700' },
  detailTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 12, lineHeight: 28 },
  detailMetaRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  detailMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailMetaText: { fontSize: 13, color: Colors.textMuted },
  detailInfoRow: { gap: 10, marginBottom: 16 },
  detailInfoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  detailInfoText: { fontSize: 15, fontWeight: '700', color: Colors.text },
  detailInfoSub: { fontSize: 13, color: Colors.textMuted, marginTop: 1 },
  residentAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  residentAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  detailBlock: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  detailBlockLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  detailBlockText: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  detailPhoto: { width: '100%', height: 200, borderRadius: 14, marginBottom: 14 },
  tapToExpand: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: -4, marginBottom: 4 },
  detailActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
  detailActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 14 },
  detailActionText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, padding: 16, marginTop: 10 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imageViewerClose: { position: 'absolute', top: 56, right: 20, zIndex: 10 },
  imageViewerImg: { width: '100%', height: '80%' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { backgroundColor: Colors.bg, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.text, marginBottom: 18, borderWidth: 1.5, borderColor: Colors.border },
  textArea: { height: 90, textAlignVertical: 'top' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: Colors.white },
  statusGrid: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statusTile: { flex: 1, alignItems: 'center', gap: 6, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, paddingVertical: 14, backgroundColor: Colors.white },
  statusTileText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textAlign: 'center' },
  photoPicker: { borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', marginBottom: 20, overflow: 'hidden' },
  photoPlaceholder: { height: 100, justifyContent: 'center', alignItems: 'center', gap: 8 },
  photoPlaceholderText: { fontSize: 13, color: Colors.textMuted },
  photoPreview: { width: '100%', height: 150 },
});
