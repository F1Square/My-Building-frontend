import { useState } from 'react';
import { Alert } from '../utils/alert';
import { copyToClipboard } from '../utils/clipboard';
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
    Alert.alert('Promote to Pramukh?', `${m.name} will become a Pramukh and gain building management access.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.post('/buildings/admin/promote', { user_id: m.id });
              onChange?.(m.id, { role: 'pramukh', status: 'approved' });
              Alert.success('Done', `${m.name} is now a Pramukh.`, 4000);
            } catch (e: any) {
              Alert.error('Error', e.response?.data?.error || 'Failed to promote', 4000);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
  };

  const demote = (m: Member) => {
    Alert.alert('Demote to User?', `${m.name} will lose Pramukh privileges and become a regular user.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Demote',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.post('/buildings/admin/demote', { user_id: m.id });
              onChange?.(m.id, { role: 'user' });
              Alert.success('Done', `${m.name} is now a User.`, 4000);
            } catch (e: any) {
              Alert.error('Error', e.response?.data?.error || 'Failed to demote', 4000);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
  };

  const remove = (m: Member) => {
    Alert.alert('Delete User?', `Permanently delete ${m.name}? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.delete(`/buildings/admin/users/${m.id}`);
              onDeleted?.(m.id);
              Alert.success('Done', 'User deleted.', 4000);
            } catch (e: any) {
              Alert.error('Error', e.response?.data?.error || 'Failed to delete', 4000);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
  };

  const ensureCode = async (m: Member) => {
    setCodeLoading(true);
    try {
      const r = await api.post('/refer/admin/ensure-code', { user_id: m.id });
      onChange?.(m.id, { referral_code: r.data.referral_code });
    } catch (e: any) {
      Alert.error('Error', e.response?.data?.error || 'Failed to generate code', 4000);
    } finally {
      setCodeLoading(false);
    }
  };

  const copyCode = async (code: string) => {
    if (await copyToClipboard(code)) {
      Alert.success('Copied!', `Referral code copied: ${code}`, 4000);
    }
  };

  return { actionLoading, codeLoading, promote, demote, remove, ensureCode, copyCode };
}
