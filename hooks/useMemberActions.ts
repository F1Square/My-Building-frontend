import { useState } from 'react';
import { Alert, Clipboard } from 'react-native';
import api from '../utils/api';
import type { Member } from '../components/MemberDetailModal';

type Options = {
  onChange?: (id: string, patch: Partial<Member>) => void;
  onDeleted?: (id: string) => void;
};

/**
 * Wraps the admin user-management API calls (promote / demote / delete /
 * ensure-referral-code) with confirmation alerts and loading state. Used
 * by both the Users screen and the per-building Members modal.
 */
export function useMemberActions({ onChange, onDeleted }: Options = {}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);

  const promote = (m: Member) => {
    Alert.alert(
      'Promote to Pramukh?',
      `${m.name} will become a Pramukh and gain building management access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.post('/buildings/admin/promote', { user_id: m.id });
              onChange?.(m.id, { role: 'pramukh', status: 'approved' });
              Alert.alert('Done', `${m.name} is now a Pramukh.`);
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error || 'Failed to promote');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const demote = (m: Member) => {
    Alert.alert(
      'Demote to User?',
      `${m.name} will lose Pramukh privileges and become a regular user.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Demote',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.post('/buildings/admin/demote', { user_id: m.id });
              onChange?.(m.id, { role: 'user' });
              Alert.alert('Done', `${m.name} is now a User.`);
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error || 'Failed to demote');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const remove = (m: Member) => {
    Alert.alert(
      'Delete User?',
      `Permanently delete ${m.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.delete(`/buildings/admin/users/${m.id}`);
              onDeleted?.(m.id);
              Alert.alert('Done', 'User deleted.');
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error || 'Failed to delete');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const ensureCode = async (m: Member) => {
    setCodeLoading(true);
    try {
      const r = await api.post('/refer/admin/ensure-code', { user_id: m.id });
      onChange?.(m.id, { referral_code: r.data.referral_code });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to generate code');
    } finally {
      setCodeLoading(false);
    }
  };

  const copyCode = (code: string) => {
    Clipboard.setString(code);
    Alert.alert('Copied!', `Referral code copied: ${code}`);
  };

  return { actionLoading, codeLoading, promote, demote, remove, ensureCode, copyCode };
}
