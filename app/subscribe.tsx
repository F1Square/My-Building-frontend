import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Linking, TextInput, Switch,
} from 'react-native';
import { Alert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { addBreadcrumb, clearBreadcrumbs } from '../utils/crashBreadcrumbs';
import * as WebBrowser from 'expo-web-browser';
import { ModuleHeader } from '../components/ModuleHeader';

const ICONS = ['calendar-outline', 'star-outline', 'infinite-outline', 'ribbon-outline', 'trophy-outline'] as const;
const COL_CYCLE = [Colors.primary, '#F59E0B', Colors.success, '#8B5CF6', '#EC4899'];

/** UI list price (struck through) vs sale price for classic plans. */
const PLAN_LIST_RUPEES: Record<string, number> = { monthly: 15, yearly: 180 };
const PLAN_SALE_RUPEES: Record<string, number> = { monthly: 10, yearly: 120 };

type CatalogPlan = {
  id: string;
  slug: string;
  title: string;
  description: string;
  amount_paise: number;
  months: number | null;
  allow_newspaper_addon: boolean;
  newspaper_addon_paise: number | null;
  platform_fee_paise?: number | null;
  other_fee_paise?: number | null;
  compare_at_paise?: number | null;
  sort_order: number;
  features: string[];
};

/** Snapshot before checkout — used to detect if *this* payment changed subscription state. */
type SubSnapshot = {
  status: string | null;
  plan: string | null;
  started_at: string | null;
  gateway_order_id: string | null;
  newspaper_addon: boolean;
};

const EMPTY_SUB_SNAPSHOT: SubSnapshot = {
  status: null,
  plan: null,
  started_at: null,
  gateway_order_id: null,
  newspaper_addon: false,
};

function toSubSnapshot(data: Record<string, unknown> | null | undefined): SubSnapshot {
  if (!data) return { ...EMPTY_SUB_SNAPSHOT };
  return {
    status: typeof data.status === 'string' ? data.status : null,
    plan: typeof data.plan === 'string' ? data.plan : null,
    started_at: typeof data.started_at === 'string' ? data.started_at : null,
    gateway_order_id:
      typeof data.gateway_order_id === 'string'
        ? data.gateway_order_id
        : typeof data.razorpay_order_id === 'string'
          ? data.razorpay_order_id
          : null,
    newspaper_addon: !!data.newspaper_addon,
  };
}

function subscriptionChangedSince(before: SubSnapshot, after: SubSnapshot): boolean {
  if (before.status !== 'active' && after.status === 'active') return true;
  if (after.status !== 'active') return false;
  if (before.plan !== after.plan) return true;
  if (before.started_at !== after.started_at) return true;
  if (!before.newspaper_addon && after.newspaper_addon) return true;
  if (before.gateway_order_id !== after.gateway_order_id && after.gateway_order_id) return true;
  return false;
}

function paymentCompletedSince(
  before: SubSnapshot,
  after: SubSnapshot,
  pendingOrderId?: string | null,
): boolean {
  if (pendingOrderId && after.gateway_order_id === pendingOrderId) return true;
  return subscriptionChangedSince(before, after);
}

export default function SubscribeScreen() {
  const [catalogPlans, setCatalogPlans] = useState<CatalogPlan[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/subscriptions/plans')
      .then((r) => {
        if (!cancelled) setCatalogPlans(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {
        if (!cancelled) setCatalogPlans([]);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const planRank = useMemo(() => {
    const m: Record<string, number> = {};
    [...catalogPlans].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).forEach((p, i) => {
      m[p.slug] = i + 1;
    });
    return m;
  }, [catalogPlans]);

  const displayPlans = useMemo(() => {
    return catalogPlans.map((p, i) => {
      const addP = p.newspaper_addon_paise;
      const addRupee = addP != null ? Math.round(addP / 100) : (p.months === 12 ? 36 : 3);
      const platformFeeRupees = Math.round((p.platform_fee_paise || 0) / 100);
      const otherFeeRupees = Math.round((p.other_fee_paise || 0) / 100);
      const fromApi = Math.round(p.amount_paise / 100);
      const saleFixed = PLAN_SALE_RUPEES[p.slug];
      const listFixed = PLAN_LIST_RUPEES[p.slug];
      // Prefer sale price for known plans so UI always shows ₹10 / ₹120
      const amountRupees = saleFixed ?? fromApi;
      const compareAtRupees =
        listFixed != null && listFixed > amountRupees
          ? listFixed
          : (p.compare_at_paise != null && p.compare_at_paise > p.amount_paise
            ? Math.round(p.compare_at_paise / 100)
            : null);
      return {
        key: p.slug,
        title: p.title,
        price: `₹${amountRupees.toLocaleString('en-IN')}`,
        amountRupees,
        compareAtRupees,
        period: p.months == null ? 'one-time' : p.months === 12 ? '/ year' : '/ month',
        desc: p.description || '',
        icon: ICONS[i % ICONS.length],
        color: COL_CYCLE[i % COL_CYCLE.length],
        highlight: i === catalogPlans.length - 1 && catalogPlans.length > 0,
        features: p.features?.length ? p.features : ['Full access to all modules'],
        months: p.months,
        allowNewspaper: !!p.allow_newspaper_addon && p.months != null,
        newspaperAddonRupees: addRupee,
        platformFeeRupees,
        otherFeeRupees,
      };
    });
  }, [catalogPlans]);

  const { subscription, hasActiveSubscription, refreshSubscription } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<'my-plan' | 'explore'>(hasActiveSubscription ? 'my-plan' : 'explore');
  const [loading, setLoading] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<any>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [includeNewspaper, setIncludeNewspaper] = useState(false);
  const [newspaperAddonLoading, setNewspaperAddonLoading] = useState(false);

  const checkoutTotalRupees = useCallback((plan: (typeof displayPlans)[number]) => {
    let total = promoResult?.final_amount != null
      ? Number(promoResult.final_amount)
      : plan.amountRupees;
    if (includeNewspaper && plan.allowNewspaper) total += plan.newspaperAddonRupees;
    total += plan.platformFeeRupees + plan.otherFeeRupees;
    return Math.max(1, Math.round(total));
  }, [promoResult, includeNewspaper]);
  const processGuardRef = useRef(0);
  const checkoutActiveRef = useRef(false);
  const lastFocusRefreshRef = useRef(0);
  /** Prevents duplicate success/failure alerts when deep link + polling both fire. */
  const paymentAlertShownRef = useRef(false);
  const { status: linkStatus, reason: linkReason } = useLocalSearchParams<{ status?: string; reason?: string }>();

  /** Poll until this checkout actually updates subscription (not merely "user has any active plan"). */
  const fetchSubSnapshot = useCallback(async (): Promise<SubSnapshot> => {
    try {
      const res = await api.get('/subscriptions/me');
      return toSubSnapshot(res.data);
    } catch {
      return { ...EMPTY_SUB_SNAPSHOT };
    }
  }, []);

  const waitForPaymentCompletion = useCallback(
    async (
      before: SubSnapshot,
      pendingOrderId?: string | null,
      maxAttempts = 2,
    ): Promise<boolean> => {
      for (let i = 0; i < maxAttempts; i++) {
        const after = await fetchSubSnapshot();
        if (paymentCompletedSince(before, after, pendingOrderId)) {
          await refreshSubscription();
          return true;
        }
        if (i < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      return false;
    },
    [fetchSubSnapshot, refreshSubscription],
  );

  // Aliases kept for Metro hot-reload (old bundle may still reference removed names)
  const waitForActiveSubscription = useCallback(
    (maxAttempts = 2) => waitForPaymentCompletion(EMPTY_SUB_SNAPSHOT, null, maxAttempts),
    [waitForPaymentCompletion],
  );
  const pollSubscriptionAfterPayment = waitForActiveSubscription;
  const confirmSubscriptionActivated = useCallback(
    () => waitForPaymentCompletion(EMPTY_SUB_SNAPSHOT, null, 1),
    [waitForPaymentCompletion],
  );

  const showPaymentSuccess = useCallback(() => {
    if (paymentAlertShownRef.current) return;
    paymentAlertShownRef.current = true;
    setTab('my-plan');
    Alert.success('Purchase successful', 'Your subscription is active. All modules are now unlocked.', 4000);
  }, []);

  const showPaymentFailed = useCallback((reason?: string | null) => {
    if (paymentAlertShownRef.current) return;
    paymentAlertShownRef.current = true;
    const detail = reason?.trim()
      ? `The payment did not finish (${reason}). You can try again from Explore Plans.`
      : 'The payment did not finish. You can try again from Explore Plans.';
    Alert.error('Payment not completed', detail, 4000);
  }, []);

  const processSubscriptionUrl = useCallback(
    async (url: string) => {
      const isReturn =
        url.startsWith('mybuilding://subscribe') ||
        url.startsWith('mybuilding://subscription');
      if (!isReturn) return;
      const now = Date.now();
      if (now - processGuardRef.current < 2500) return;
      processGuardRef.current = now;

      await addBreadcrumb('subscription', 'deep_link_received', { url });
      const queryPart = url.includes('?') ? url.split('?')[1] : '';
      const params = new URLSearchParams(queryPart);
      const status = params.get('status');
      const reason = params.get('reason');
      if (status === 'success') {
        await refreshSubscription();
        await addBreadcrumb('subscription', 'deep_link_success_refresh_done');
        showPaymentSuccess();
      } else if (status === 'failed') {
        await refreshSubscription();
        showPaymentFailed(reason ? decodeURIComponent(reason) : null);
      }
    },
    [refreshSubscription, showPaymentSuccess, showPaymentFailed],
  );

  useEffect(() => {
    if (linkStatus === 'success' || linkStatus === 'failed') {
      const qs = linkReason
        ? `mybuilding://subscribe?status=${linkStatus}&reason=${encodeURIComponent(String(linkReason))}`
        : `mybuilding://subscribe?status=${linkStatus}`;
      void processSubscriptionUrl(qs);
    }
  }, [linkStatus, linkReason, processSubscriptionUrl]);

  // Handle deep link return from payment gateway (cold start / background)
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      await processSubscriptionUrl(event.url);
    };

    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) return processSubscriptionUrl(initialUrl);
      })
      .catch(() => null);

    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, [processSubscriptionUrl]);

  // Refresh when returning to this screen (e.g. user left in-app browser manually)
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      // Allow refresh if: (1) checkout not active, OR (2) >5s since last refresh
      if (!checkoutActiveRef.current || now - lastFocusRefreshRef.current > 5000) {
        lastFocusRefreshRef.current = now;
        void refreshSubscription();
      }
    }, [refreshSubscription]),
  );

  /**
   * Opens Easebuzz in an in-app auth session (SFAuthenticationSession / Chrome Custom Tabs).
   * `Linking.openURL` sends iOS Safari to the gateway; Safari cannot hand `mybuilding://`
   * back to the app, which caused “Safari cannot open this page” and a stale subscription UI.
   */
  const openCheckoutSafely = async (
    checkoutUrl?: string,
    beforeCheckout: SubSnapshot = EMPTY_SUB_SNAPSHOT,
    pendingOrderId?: string | null,
  ) => {
    if (!checkoutUrl || typeof checkoutUrl !== 'string') {
      await addBreadcrumb('subscription', 'checkout_url_invalid', { checkoutUrl });
      throw new Error('Payment link is unavailable. Please try again.');
    }
    await addBreadcrumb('subscription', 'checkout_open_start');
    checkoutActiveRef.current = true;
    paymentAlertShownRef.current = false;
    let outcome: { type: 'completed' | 'dismissed' } = { type: 'dismissed' };
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        checkoutUrl,
        'mybuilding://subscribe',
      );
      await addBreadcrumb('subscription', 'auth_session_result', { type: result.type });

      if (result.type === 'success' && 'url' in result && result.url) {
        await processSubscriptionUrl(result.url);
        outcome = { type: 'completed' };
        return outcome;
      }

      // Browser closed without deep link — only succeed if this order actually updated subscription
      if (await waitForPaymentCompletion(beforeCheckout, pendingOrderId, 2)) {
        showPaymentSuccess();
        outcome = { type: 'completed' };
        return outcome;
      }
      return outcome;
    } finally {
      checkoutActiveRef.current = false;
      await WebBrowser.coolDownAsync().catch(() => {});

      // Final fallback only when no alert was shown yet (avoids duplicate with deep link path)
      if (!paymentAlertShownRef.current) {
        await new Promise(r => setTimeout(r, 2000));
        if (await waitForPaymentCompletion(beforeCheckout, pendingOrderId, 1)) {
          await addBreadcrumb('subscription', 'fallback_polling_success');
          showPaymentSuccess();
          outcome = { type: 'completed' };
        } else {
          await addBreadcrumb('subscription', 'fallback_polling_no_active_subscription');
        }
      }
    }
    return outcome;
  };

  const subscribe = async (planSlug: string) => {
    setLoading(planSlug);
    try {
      const row = catalogPlans.find((p) => p.slug === planSlug);
      const isLifetimeCheckout = row ? row.months == null : planSlug === 'lifetime';
      await clearBreadcrumbs();
      await addBreadcrumb('subscription', 'subscribe_plan_start', { plan: planSlug });
      const beforeCheckout = await fetchSubSnapshot();
      const orderRes = await api.post('/subscriptions/order', {
        plan: planSlug,
        promo_id: promoResult?.promo_id || undefined,
        include_newspaper: isLifetimeCheckout ? false : includeNewspaper,
      });
      await addBreadcrumb('subscription', 'subscribe_order_success', { hasCheckoutUrl: !!orderRes?.data?.checkout_url });
      const checkoutUrl = orderRes?.data?.checkout_url;
      const pendingOrderId = orderRes?.data?.order_id ?? null;
      const result = await openCheckoutSafely(checkoutUrl, beforeCheckout, pendingOrderId);

      if (result.type === 'completed') {
        await addBreadcrumb('subscription', 'checkout_completed_via_redirect');
      } else {
        await addBreadcrumb('subscription', 'checkout_session_dismissed_poll_done');
      }
      setPromoCode('');
      setPromoResult(null);
      await addBreadcrumb('subscription', 'subscribe_plan_flow_done', { plan: planSlug, resultType: result?.type });
    } catch (e: any) {
      await addBreadcrumb('subscription', 'subscribe_plan_error', { message: e?.message, data: e?.response?.data });
      Alert.error('Error', e.response?.data?.error || 'Failed to initiate payment', 4000);
    } finally {
      setLoading(null);
    }
  };

  // Enable newspaper add-on for existing subscriber (gateway payment)
  const enableNewspaperAddon = async (plan?: string) => {
    setNewspaperAddonLoading(true);
    try {
      await clearBreadcrumbs();
      await addBreadcrumb('subscription', 'newspaper_addon_start', { plan });
      const beforeCheckout = await fetchSubSnapshot();
      const orderRes = await api.post('/subscriptions/newspaper-addon/order', { plan });
      await addBreadcrumb('subscription', 'newspaper_addon_order_success', { hasCheckoutUrl: !!orderRes?.data?.checkout_url });
      const checkoutUrl = orderRes?.data?.checkout_url;
      const pendingOrderId = orderRes?.data?.order_id ?? null;
      const result = await openCheckoutSafely(checkoutUrl, beforeCheckout, pendingOrderId);

      if (result.type === 'completed') {
        await addBreadcrumb('subscription', 'newspaper_addon_completed_via_redirect');
      }
      await addBreadcrumb('subscription', 'newspaper_addon_flow_done', { resultType: result?.type });
    } catch (e: any) {
      await addBreadcrumb('subscription', 'newspaper_addon_error', { message: e?.message, data: e?.response?.data });
      Alert.error('Error', e.response?.data?.error || 'Failed to initiate payment', 4000);
    } finally {
      setNewspaperAddonLoading(false);
    }
  };

  // Disable full subscription plan + newspaper add-on
  const disablePlan = () => {
    Alert.alert(
      'Disable plan',
      'This will disable your subscription and newspaper access. You can subscribe again anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            setNewspaperAddonLoading(true);
            try {
              await api.post('/subscriptions/cancel');
              await refreshSubscription();
              Alert.success('Plan disabled', 'Your subscription and newspaper access are now off.', 4000);
            } catch (e: any) {
              Alert.error('Error', e.response?.data?.error || 'Failed to disable plan', 4000);
            } finally {
              setNewspaperAddonLoading(false);
            }
          },
        },
      ],
    );
  };

  // Disable newspaper add-on only (keeps main plan active)
  const disableNewspaperAddon = () => {
    Alert.alert(
      'Disable newspaper',
      'This will turn off newspaper access only. Your subscription plan stays active.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            setNewspaperAddonLoading(true);
            try {
              await api.post('/subscriptions/newspaper-addon', { enable: false });
              await refreshSubscription();
              Alert.success('Newspaper disabled', 'Newspaper add-on is now off.', 4000);
            } catch (e: any) {
              Alert.error('Error', e.response?.data?.error || 'Failed to disable newspaper', 4000);
            } finally {
              setNewspaperAddonLoading(false);
            }
          },
        },
      ],
    );
  };

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    const planForPromo = catalogPlans[0]?.slug || 'monthly';
    setPromoLoading(true);
    try {
      const res = await api.post('/promos/validate', { code: promoCode.trim(), plan: planForPromo });
      setPromoResult(res.data);
    } catch (e: any) {
      Alert.error('Invalid Code', e.response?.data?.error || 'Promo code not valid', 4000);
      setPromoResult(null);
    } finally { setPromoLoading(false); }
  };

  const isExpired = subscription?.status === 'expired';
  const currentCat = catalogPlans.find((c) => c.slug === subscription?.plan);
  const isLifetime = currentCat ? currentCat.months == null : subscription?.plan === 'lifetime';
  const isYearly = currentCat ? currentCat.months === 12 : subscription?.plan === 'yearly';
  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null;
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const newspaperExpiresAt = subscription?.newspaper_expires_at
    ? new Date(subscription.newspaper_expires_at)
    : null;
  // Prefer dedicated newspaper expiry; fall back to plan expiry for older grants.
  const newspaperExpiryShown = newspaperExpiresAt || (!isLifetime ? expiresAt : null);

  const planLabel = currentCat?.title || (isLifetime ? 'Lifetime Plan' : isYearly ? 'Yearly Plan' : subscription?.plan ? subscription.plan : 'Plan');
  const planPrice = currentCat
    ? `₹${(currentCat.amount_paise / 100).toLocaleString('en-IN')}${isLifetime ? '' : isYearly ? '/yr' : '/mo'}`
    : isLifetime ? '₹1,500' : isYearly ? '₹120/yr' : '₹10/mo';
  const planIcon = isLifetime ? 'infinite-outline' : isYearly ? 'star-outline' : 'calendar-outline';
  const planColor = isLifetime ? Colors.success : isYearly ? '#F59E0B' : Colors.primary;

  const minNewsRupee = useMemo(() => {
    const vals = catalogPlans
      .filter((p) => p.months != null && p.allow_newspaper_addon)
      .map((p) => {
        const addP = p.newspaper_addon_paise;
        return addP != null ? Math.round(addP / 100) : (p.months === 12 ? 36 : 3);
      });
    return vals.length ? Math.min(...vals) : 3;
  }, [catalogPlans]);



  return (
    <View style={styles.container}>
      {/* Header */}
      <ModuleHeader title="Subscription" />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab === 'my-plan' && styles.tabActive]} onPress={() => setTab('my-plan')}>
          <Text style={[styles.tabText, tab === 'my-plan' && styles.tabTextActive]}>My Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'explore' && styles.tabActive]} onPress={() => setTab('explore')}>
          <Text style={[styles.tabText, tab === 'explore' && styles.tabTextActive]}>Explore Plans</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── My Plan Tab ── */}
        {tab === 'my-plan' && (
          <>
            {hasActiveSubscription && subscription ? (
              <>
                <View style={styles.activePlanCard}>
                  <View style={styles.activePlanTop}>
                    <View style={[styles.planIconBox, { backgroundColor: planColor + '20' }]}>
                      <Ionicons name={planIcon as any} size={28} color={planColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activePlanTitle}>{planLabel}</Text>
                      <View style={styles.activeBadge}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeBadgeText}>{t('active')}</Text>
                      </View>
                    </View>
                    <Text style={styles.activePlanPrice}>{planPrice}</Text>
                  </View>

                  <View style={styles.divider} />

                  {isLifetime ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="infinite" size={16} color={Colors.success} />
                      <Text style={styles.infoText}>{"Never expires — you're set for life"}</Text>
                    </View>
                  ) : (
                    <View style={styles.infoRow}>
                      <Ionicons name="time-outline" size={16} color={daysLeft && daysLeft <= 5 ? Colors.danger : Colors.primary} />
                      <Text style={[styles.infoText, daysLeft !== null && daysLeft <= 5 ? { color: Colors.danger } : undefined]}>
                        {daysLeft !== null && daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining` : 'Expires today'}
                      </Text>
                    </View>
                  )}

                  {expiresAt && (
                    <View style={styles.infoRow}>
                      <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                      <Text style={styles.infoText}>Renews on {expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                    </View>
                  )}

                  <View style={styles.infoRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.infoText}>All modules unlocked</Text>
                  </View>

                  {!isLifetime && (
                    <TouchableOpacity style={styles.upgradeBtn} onPress={() => setTab('explore')}>
                      <Ionicons name="arrow-up-circle-outline" size={18} color={Colors.success} />
                      <Text style={styles.upgradeBtnText}>
                        {isYearly ? 'Upgrade to Lifetime' : 'Upgrade Plan'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={disablePlan}
                    style={styles.planDisableBtn}
                    disabled={newspaperAddonLoading}
                  >
                    {newspaperAddonLoading
                      ? <ActivityIndicator size="small" color={Colors.danger} />
                      : <Text style={styles.addonDisableBtnText}>Disable plan</Text>}
                  </TouchableOpacity>
                </View>

                {/* Newspaper Add-On Card */}
                <View style={styles.addonCardLarge}>
                  <View style={styles.addonHeader}>
                    <View style={styles.addonIconBox}>
                      <Ionicons name="newspaper-outline" size={24} color="#EA580C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addonTitleLarge}>📰 Newspaper</Text>
                      <Text style={styles.addonDescLarge}>Daily newspapers in English, Hindi & Gujarati</Text>
                    </View>
                    {subscription?.newspaper_addon && (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>Active</Text>
                      </View>
                    )}
                  </View>

                  {subscription?.newspaper_addon ? (
                    <View style={styles.addonActiveInfo}>
                      {newspaperExpiryShown ? (
                        <View style={styles.infoRow}>
                          <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                          <Text style={styles.infoText}>
                            Expires on {newspaperExpiryShown.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.infoRow}>
                          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                          <Text style={styles.infoText}>Newspaper access is active</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={disableNewspaperAddon}
                        style={[styles.addonDisableBtn, { alignSelf: 'stretch', marginTop: 12, alignItems: 'center' }]}
                        disabled={newspaperAddonLoading}
                      >
                        {newspaperAddonLoading
                          ? <ActivityIndicator size="small" color={Colors.danger} />
                          : <Text style={styles.addonDisableBtnText}>Disable plan</Text>}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.addonOptionsGrid}>
                      <TouchableOpacity
                        style={styles.addonOption}
                        onPress={() => enableNewspaperAddon('monthly')}
                        disabled={newspaperAddonLoading}
                      >
                        <Text style={styles.addonOptionTitle}>Monthly</Text>
                        <Text style={styles.addonOptionPrice}>₹3</Text>
                        <View style={styles.addonOptionBtn}><Text style={styles.addonOptionBtnText}>Add</Text></View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.addonOption}
                        onPress={() => enableNewspaperAddon('yearly')}
                        disabled={newspaperAddonLoading}
                      >
                        <Text style={styles.addonOptionTitle}>Yearly</Text>
                        <Text style={styles.addonOptionPrice}>₹36</Text>
                        <View style={styles.addonOptionBtn}><Text style={styles.addonOptionBtnText}>Add</Text></View>
                      </TouchableOpacity>
                    </View>
                  )}
                  {newspaperAddonLoading && !subscription?.newspaper_addon && (
                    <ActivityIndicator style={{ marginTop: 12 }} color={Colors.primary} />
                  )}
                </View>
              </>
            ) : (
              <View style={styles.noSubCard}>
                <Ionicons name="lock-closed-outline" size={48} color={Colors.border} style={{ marginBottom: 12 }} />
                <Text style={styles.noSubTitle}>{isExpired ? 'Subscription Expired' : 'No Active Subscription'}</Text>
                <Text style={styles.noSubDesc}>
                  {isExpired
                    ? 'Your plan has expired. Renew to regain access to all modules.'
                    : 'Subscribe to unlock all features and modules.'}
                </Text>
                <TouchableOpacity style={styles.exploreBtn} onPress={() => setTab('explore')}>
                  <Text style={styles.exploreBtnText}>View Plans</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ── Explore Plans Tab ── */}
        {tab === 'explore' && (
          <>
            <Text style={styles.exploreHeading}>Choose a Plan</Text>
            <Text style={styles.exploreSubheading}>Unlock all features with a simple subscription</Text>

            {/* Newspaper add-on toggle for new subscribers */}
            <TouchableOpacity
              style={[styles.addonCard, includeNewspaper && styles.addonCardActive]}
              onPress={() => setIncludeNewspaper(v => !v)}
              activeOpacity={0.8}
            >
              <View style={styles.addonLeft}>
                <View style={styles.addonIconBox}>
                  <Ionicons name="newspaper-outline" size={22} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addonTitle}>📰 Newspaper</Text>
                  <Text style={styles.addonDesc}>Daily English, Hindi & Gujarati newspapers</Text>
                  <Text style={styles.addonPrice}>From +₹{minNewsRupee} / month tier</Text>
                </View>
              </View>
              <Switch
                value={includeNewspaper}
                onValueChange={setIncludeNewspaper}
                trackColor={{ false: Colors.border, true: '#EA580C' }}
                thumbColor={Colors.white}
              />
            </TouchableOpacity>

            {/* Promo code input */}
            <View style={styles.promoBox}>
              <Ionicons name="pricetag-outline" size={18} color={Colors.primary} />
              <TextInput
                style={styles.promoInput}
                value={promoCode}
                onChangeText={v => { setPromoCode(v.toUpperCase()); setPromoResult(null); }}
                placeholder="Have a promo code?"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.promoApplyBtn, !promoCode.trim() && { opacity: 0.4 }]}
                onPress={() => applyPromo()}
                disabled={!promoCode.trim() || promoLoading}
              >
                {promoLoading
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.promoApplyText}>Apply</Text>}
              </TouchableOpacity>
            </View>
            {promoResult && (
              <View style={styles.promoSuccess}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.promoSuccessText}>
                  {promoResult.type === 'percent'
                    ? `${promoResult.value}% discount applied!`
                    : `₹${promoResult.value} discount applied!`}
                  {promoResult.description ? ` · ${promoResult.description}` : ''}
                </Text>
                <TouchableOpacity onPress={() => { setPromoCode(''); setPromoResult(null); }}>
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            {catalogLoading && displayPlans.length === 0 ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color={Colors.primary} />
            ) : null}
            {!catalogLoading && displayPlans.length === 0 ? (
              <Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 24 }}>
                Plans are not available. Please try again later.
              </Text>
            ) : null}

            {displayPlans.map(plan => {
              const isCurrent = subscription?.plan === plan.key && hasActiveSubscription;
              const currentRank = hasActiveSubscription && subscription?.plan
                ? (planRank[subscription.plan] ?? 0)
                : 0;
              const isLowerOrEqual = hasActiveSubscription && (planRank[plan.key] ?? 0) <= currentRank && !isCurrent;
              const isDisabled = !!loading || isLowerOrEqual;

              return (
                <View key={plan.key} style={[styles.planCard, plan.highlight && styles.planCardHighlight]}>
                  {plan.highlight && (
                    <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>BEST VALUE</Text></View>
                  )}
                  <View style={styles.planTop}>
                    <View style={[styles.planIconBox, { backgroundColor: plan.color + '20' }]}>
                      <Ionicons name={plan.icon as any} size={26} color={plan.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>{plan.title}</Text>
                      <Text style={styles.planDesc}>{plan.desc}</Text>
                    </View>
                    <View style={styles.planPriceBox}>
                      <View style={styles.planPriceRow}>
                        {plan.compareAtRupees != null && (
                          <Text style={styles.planPriceWas}>
                            ₹{plan.compareAtRupees.toLocaleString('en-IN')}
                          </Text>
                        )}
                        <Text style={[styles.planPrice, { color: plan.color }]}>{plan.price}</Text>
                      </View>
                      <Text style={styles.planPeriod}>{plan.period}</Text>
                    </View>
                  </View>

                  <View style={styles.featureList}>
                    {plan.features.map(f => (
                      <View key={f} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={15} color={plan.color} />
                        <Text style={styles.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>

                  {(plan.platformFeeRupees > 0 || plan.otherFeeRupees > 0) && (
                    <View style={styles.feeBox}>
                      {plan.platformFeeRupees > 0 && (
                        <View style={styles.feeRow}>
                          <Text style={styles.feeLabel}>Platform fee</Text>
                          <Text style={styles.feeValue}>₹{plan.platformFeeRupees.toLocaleString('en-IN')}</Text>
                        </View>
                      )}
                      {plan.otherFeeRupees > 0 && (
                        <View style={styles.feeRow}>
                          <Text style={styles.feeLabel}>Other fee</Text>
                          <Text style={styles.feeValue}>₹{plan.otherFeeRupees.toLocaleString('en-IN')}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {isCurrent ? (
                    <View style={[styles.currentBtn, { borderColor: plan.color }]}>
                      <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                      <Text style={[styles.currentBtnText, { color: plan.color }]}>Current Plan</Text>
                    </View>
                  ) : isLowerOrEqual ? (
                    <View style={styles.disabledBtn}>
                      <Ionicons name="lock-closed-outline" size={15} color={Colors.textMuted} />
                      <Text style={styles.disabledBtnText}>Not Available</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.subscribeBtn, { backgroundColor: plan.color }, isDisabled && styles.subscribeBtnDisabled]}
                      onPress={() => subscribe(plan.key)}
                      disabled={isDisabled}
                    >
                      {loading === plan.key
                        ? <ActivityIndicator color={Colors.white} />
                        : <Text style={styles.subscribeBtnText}>
                          {hasActiveSubscription ? 'Upgrade' : 'Subscribe'}
                          {' — '}
                          ₹{checkoutTotalRupees(plan).toLocaleString('en-IN')}
                          {includeNewspaper && plan.allowNewspaper ? ' (incl. newspaper)' : ''}
                        </Text>}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: '800' },
  scroll: { padding: 16 },

  // My Plan
  activePlanCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 4 },
  activePlanTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  planIconBox: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  activePlanTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  activeBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.success },
  activePlanPrice: { fontSize: 18, fontWeight: '800', color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoText: { fontSize: 14, color: Colors.text },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, borderWidth: 1.5, borderColor: Colors.success, borderRadius: 12, paddingVertical: 12 },
  upgradeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.success },
  planDisableBtn: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    alignItems: 'center',
  },
  noSubCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  noSubTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  noSubDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  exploreBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 },
  exploreBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  // Explore Plans
  exploreHeading: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  exploreSubheading: { fontSize: 14, color: Colors.textMuted, marginBottom: 20 },
  planCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 4, borderWidth: 2, borderColor: 'transparent' },
  planCardHighlight: { borderColor: Colors.success },
  bestBadge: { backgroundColor: Colors.success, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 12 },
  bestBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  planTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  planDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  planPriceBox: { alignItems: 'flex-end' },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  planPriceWas: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
  },
  planPrice: { fontSize: 22, fontWeight: '800' },
  planPeriod: { fontSize: 11, color: Colors.textMuted },
  featureList: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: Colors.text },
  subscribeBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  subscribeBtnDisabled: { opacity: 0.45 },
  subscribeBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  currentBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 13 },
  currentBtnText: { fontSize: 14, fontWeight: '700' },
  disabledBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 13, backgroundColor: Colors.bg },
  disabledBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  promoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  promoInput: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '600', letterSpacing: 1 },
  promoApplyBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  promoApplyText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  promoSuccess: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.success + '12', borderRadius: 10, padding: 10, marginBottom: 12 },
  promoSuccessText: { flex: 1, fontSize: 13, color: Colors.success, fontWeight: '600' },

  // Newspaper add-on
  addonCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    marginTop: 12, borderWidth: 1.5, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  addonCardActive: { borderColor: '#EA580C', backgroundColor: '#FFF7ED' },
  addonLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  addonIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' },
  addonTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  addonDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  addonPrice: { fontSize: 13, fontWeight: '800', color: '#EA580C', marginTop: 3 },
  addonEnableBtn: { backgroundColor: '#EA580C', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addonEnableBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  addonDisableBtn: { borderWidth: 1.5, borderColor: Colors.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addonDisableBtnText: { color: Colors.danger, fontWeight: '700', fontSize: 13 },
  // Large addon card
  addonCardLarge: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, marginTop: 16, borderWidth: 1.5, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
  addonHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  addonTitleLarge: { fontSize: 16, fontWeight: '800', color: Colors.text },
  addonDescLarge: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  activePill: { backgroundColor: Colors.success + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  activePillText: { fontSize: 11, fontWeight: '800', color: Colors.success },
  addonOptionsGrid: { flexDirection: 'row', gap: 10 },
  addonOption: { flex: 1, backgroundColor: Colors.bg, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  addonOptionHighlight: { borderColor: Colors.success + '40', backgroundColor: Colors.success + '05' },
  addonOptionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  addonOptionPrice: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  addonOptionBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, width: '100%', alignItems: 'center' },
  addonOptionBtnText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  bestBadgeMini: { position: 'absolute', top: -8, backgroundColor: Colors.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  bestBadgeTextMini: { color: Colors.white, fontSize: 9, fontWeight: '900' },
  addonActiveInfo: { alignItems: 'center', paddingTop: 8 },
  addonStatusText: { fontSize: 13, color: Colors.success, fontWeight: '600', marginBottom: 12 },
  addonDisableBtnFull: { width: '100%', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, alignItems: 'center' },
  feeBox: {
    backgroundColor: Colors.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  feeValue: { fontSize: 13, color: Colors.text, fontWeight: '700' },
});

