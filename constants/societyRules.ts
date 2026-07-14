/** Shared society-rules categories, icons, and colors (mobile). */
export const RULE_CATEGORIES = [
  'General', 'Parking', 'Noise', 'Cleanliness', 'Security', 'Pets', 'Guests', 'Other',
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const CAT_ICONS: Record<string, string> = {
  General: 'document-text-outline',
  Parking: 'car-outline',
  Noise: 'volume-high-outline',
  Cleanliness: 'trash-outline',
  Security: 'shield-outline',
  Pets: 'paw-outline',
  Guests: 'people-outline',
  Other: 'ellipsis-horizontal-circle-outline',
};

export const CAT_COLORS: Record<string, string> = {
  General: '#3B5FC0',
  Parking: '#0D9488',
  Noise: '#D97706',
  Cleanliness: '#16A34A',
  Security: '#EF4444',
  Pets: '#EC4899',
  Guests: '#7C3AED',
  Other: '#6B7280',
};
