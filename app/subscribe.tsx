import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, Linking, TextInput, Switch,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { API_BASE } from '../constants/api';

// Plan rank — higher = better. User can only subscribe to a plan strictly higher than current.
const PLAN_RANK: Record<string, number> = { monthly: 1, yearly: 2, lifetime: 3 };

export default function SubscribeScreen() {
  const PLANS = [
    {
      key: 'monthly',
      title: 'Monthly Plan',
      price: '₹15',
      period: '/ month',
      desc: 'Billed every month. Cancel anytime.',
      icon: 'calendar-outline' as const,
      color: Colors.primary,
      features: ['Full access to all modules', 'Maintenance billing & payments', 'Visitor management', 'Complaints & announcements'],
    },
    {
      key: 'yearly',
      title: 'Yearly Plan',
      price: '₹180',
      period: '/ year',
      desc: 'Billed annually. No monthly hassle.',
      icon: 'star-outline' as const,
      color: '#F59E0B',
      highlight: false,
      features: ['Everything in Monthly', 'No monthly hassle', 'All modules included'],
    },
    {
      key: 'lifetime',
      title: 'Lifetime Plan',
      price: '₹1,500',
      period: 'one-time',
      desc: 'Pay once, use forever. Best value.',
      icon: 'infinite-outline' as const,
      color: Colors.success,
      highlight: true,
      features: ['Everything in Yearly', 'No recurring charges', 'Priority support', 'All future features included'],
    },
  ];
  const { user, subscription, hasActiveSubscription, refreshSubscription } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<'my-plan' | 'explore'>(hasActiveSubscription ? 'my-plan' : 'explore');
  const [loading, setLoading] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<any>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [includeNewspaper, setIncludeNewspaper] = useState(false);
  const [newspaperAddonLoading, setNewspaperAddonLoading] = useState(false);

  // Handle deep link return from Razorpay
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      if (!event.url.startsWith('mybuilding://subscription')) return;
      const params = new URLSearchParams(event.url.split('?')[1]);
      if (params.get('status') === 'success') {
        await refreshSubscription();
        setTab('my-plan');
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  const subscribe = async (plan: string) => {
    setLoading(plan);
    try {
      const orderRes = await api.post('/subscriptions/order', {
        plan,
        promo_id: promoResult?.promo_id || undefined,
        include_newspaper: includeNewspaper,
      });
      const { checkout_url } = orderRes.data;
      
      const result = await WebBrowser.openAuthSessionAsync(checkout_url, 'mybuilding://subscription');
      
      if (result.type === 'success') {
        setTimeout(async () => {
          await refreshSubscription();
          setTab('my-plan');
        }, 1000);
      } else {
        await refreshSubscription();
      }
      setPromoCode('');
      setPromoResult(null);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setLoading(null);
    }
  };

  // Enable newspaper add-on for existing subscriber (₹3 Razorpay payment)
  const enableNewspaperAddon = async () => {
    setNewspaperAddonLoading(true);
    try {
      const orderRes = await api.post('/subscriptions/newspaper-addon/order');
      const { checkout_url } = orderRes.data;
      
      const result = await WebBrowser.openAuthSessionAsync(checkout_url, 'mybuilding://subscription');
      
      if (result.type === 'success') {
        setTimeout(refreshSubscription, 1000);
      } else {
        await refreshSubscription();
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setNewspaperAddonLoading(false);
    }
  };

  // Disable newspaper add-on
  const disableNewspaperAddon = async () => {
    Alert.alert('Disable Newspaper', 'Are you sure you want to disable the newspaper add-on?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disable', style: 'destructive', onPress: async () => {
        setNewspaperAddonLoading(true);
        try {
          await api.post('/subscriptions/newspaper-addon', { enable: false });
          await refreshSubscription();
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.error || 'Failed');
        } finally {
          setNewspaperAddonLoading(false);
        }
      }},
    ]);
  };

  const applyPromo = async (plan: string) => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await api.post('/promos/validate', { code: promoCode.trim(), plan });
      setPromoResult(res.data);
    } catch (e: any) {
      Alert.alert('Invalid Code', e.response?.data?.error || 'Promo code not valid');
      setPromoResult(null);
    } finally { setPromoLoading(false); }
  };

  const isExpired = subscription?.status === 'expired';
  const isLifetime = subscription?.plan === 'lifetime';
  const isYearly = subscription?.plan === 'yearly';
  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null;
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const planLabel = isLifetime ? 'Lifetime Plan' : isYearly ? 'Yearly Plan' : 'Monthly Plan';
  const planPrice = isLifetime ? '₹1,500' : isYearly ? '₹180/yr' : '₹15/mo';
  const planIcon  = isLifetime ? 'infinite-outline' : isYearly ? 'star-outline' : 'calendar-outline';
  const planColor = isLifetime ? Colors.success : isYearly ? '#F59E0B' : Colors.primary;

  

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={{ width: 36 }} />
      </View>

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
                    <Text style={styles.infoText}>Never expires — you're set for life</Text>
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
              </View>

              {/* Newspaper Add-On Card */}
              <View style={styles.addonCard}>
                <View style={styles.addonLeft}>
                  <View style={styles.addonIconBox}>
                    <Ionicons name="newspaper-outline" size={22} color="#EA580C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addonTitle}>📰 Newspaper Add-On</Text>
                    <Text style={styles.addonDesc}>
                      {subscription?.newspaper_addon
                        ? 'Daily newspapers in English, Hindi & Gujarati — Active ✓'
                        : 'Read daily newspapers in English, Hindi & Gujarati'}
                    </Text>
                    <Text style={styles.addonPrice}>
                      {isLifetime ? '+₹500 / lifetime' : isYearly ? '+₹36 / year' : '+₹3 / month'}
                    </Text>
                  </View>
                </View>
                {newspaperAddonLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : subscription?.newspaper_addon ? (
                  <TouchableOpacity onPress={disableNewspaperAddon} style={styles.addonDisableBtn}>
                    <Text style={styles.addonDisableBtnText}>Disable</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={enableNewspaperAddon} style={styles.addonEnableBtn}>
                    <Text style={styles.addonEnableBtnText}>
                      {isLifetime ? 'Add ₹500' : isYearly ? 'Add ₹36' : 'Add ₹3'}
                    </Text>
                  </TouchableOpacity>
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
                  <Text style={styles.addonTitle}>📰 Newspaper Add-On</Text>
                  <Text style={styles.addonDesc}>Daily English, Hindi & Gujarati newspapers</Text>
                  <Text style={styles.addonPrice}>From +₹3 / month</Text>
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
                onPress={() => applyPromo('monthly')}
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

            {PLANS.map(plan => {
              const isCurrent = subscription?.plan === plan.key && hasActiveSubscription;
              const currentRank = hasActiveSubscription && subscription?.plan
                ? (PLAN_RANK[subscription.plan] ?? 0)
                : 0;
              const isLowerOrEqual = hasActiveSubscription && PLAN_RANK[plan.key] <= currentRank && !isCurrent;
              const isDisabled = !!loading || isLowerOrEqual;

              return (
                <View key={plan.key} style={[styles.planCard, plan.highlight && styles.planCardHighlight]}>
                  {plan.highlight && (
                    <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>BEST VALUE</Text></View>
                  )}
                  <View style={styles.planTop}>
                    <View style={[styles.planIconBox, { backgroundColor: plan.color + '20' }]}>
                      <Ionicons name={plan.icon} size={26} color={plan.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>{plan.title}</Text>
                      <Text style={styles.planDesc}>{plan.desc}</Text>
                    </View>
                    <View style={styles.planPriceBox}>
                      <Text style={[styles.planPrice, { color: plan.color }]}>{plan.price}</Text>
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
                            {hasActiveSubscription ? `Upgrade — ${plan.price}` : `Subscribe — ${plan.price}`}
                            {includeNewspaper ? ` + ${plan.key === 'lifetime' ? '₹500' : plan.key === 'yearly' ? '₹36' : '₹3'} newspaper` : ''}
                            {promoResult && promoResult.final_amount !== undefined
                              ? ` → ₹${promoResult.final_amount}` : ''}
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
  planPrice: { fontSize: 20, fontWeight: '800' },
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
});

