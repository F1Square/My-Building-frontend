// Design Tokens - Centralized styling constants
export const DesignTokens = {
  // Border Radius
  borderRadius: {
    xs: 6,
    sm: 8,
    md: 10,
    lg: 12,
    xl: 14,
    xxl: 24,
    round: 999,
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },

  // Padding
  padding: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 16,
    xl: 20,
  },

  // Font Sizes
  fontSize: {
    xs: 11,
    sm: 12,
    md: 13,
    base: 14,
    lg: 15,
    xl: 16,
    xxl: 18,
    xxxl: 20,
    huge: 22,
  },

  // Font Weights
  fontWeight: {
    normal: '400' as const,
    medium: '600' as const,
    semibold: '700' as const,
    bold: '800' as const,
  },

  // Shadows
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
  },

  // Icon Sizes
  iconSize: {
    xs: 14,
    sm: 16,
    md: 18,
    lg: 20,
    xl: 24,
  },
};
