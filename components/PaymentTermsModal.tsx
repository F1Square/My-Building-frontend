import React, { memo } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

export type PaymentTermsSection = {
  heading: string;
  body: string;
  note?: string;
};

export type PaymentTermsData = {
  app_owner: string;
  payment_gateway: string;
  title: string;
  sections: PaymentTermsSection[];
  acceptance_text: string;
};

type Props = {
  visible: boolean;
  terms: PaymentTermsData | null;
  loading?: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
};

function PaymentTermsModal({
  visible,
  terms,
  loading,
  onClose,
  onAccept,
  showAcceptButton = true,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{terms?.title || 'Payment Terms & Conditions'}</Text>
            {terms?.payment_gateway && (
              <Text style={styles.subtitle}>
                {terms.payment_gateway} · Owner: {terms.app_owner}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {terms?.sections?.map((section) => (
              <View key={section.heading} style={styles.section}>
                <Text style={styles.sectionHeading}>{section.heading}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
                {section.note ? (
                  <View style={styles.noteBox}>
                    <Ionicons name="time-outline" size={14} color={Colors.warning} />
                    <Text style={styles.noteText}>{section.note}</Text>
                  </View>
                ) : null}
              </View>
            ))}

            {terms?.acceptance_text ? (
              <View style={styles.acceptanceBox}>
                <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
                <Text style={styles.acceptanceText}>{terms.acceptance_text}</Text>
              </View>
            ) : null}
          </ScrollView>
        )}

        <View style={styles.footer}>
          {showAcceptButton && onAccept ? (
            <>
              <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                <Text style={styles.acceptBtnText}>I Accept Terms & Conditions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.acceptBtn} onPress={onClose}>
              <Text style={styles.acceptBtnText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default memo(PaymentTermsModal);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  loader: { marginTop: 60 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 8 },
  section: { marginBottom: 20 },
  sectionHeading: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  sectionBody: { fontSize: 14, color: Colors.textMuted, lineHeight: 22 },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    backgroundColor: Colors.warning + '15',
    borderRadius: 10,
    padding: 12,
  },
  noteText: { flex: 1, fontSize: 13, color: Colors.warning, lineHeight: 19 },
  acceptanceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  acceptanceText: { flex: 1, fontSize: 13, color: Colors.primary, lineHeight: 20, fontWeight: '600' },
  footer: { padding: 20, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.border, gap: 10 },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  acceptBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
});
