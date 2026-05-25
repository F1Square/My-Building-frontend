import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { DesignTokens } from '../constants/designTokens';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  startIndex: number;
  endIndex: number;
  totalItems: number;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onNextPage,
  onPrevPage,
  hasNextPage,
  hasPrevPage,
  startIndex,
  endIndex,
  totalItems,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.info}>
        Showing {startIndex}-{endIndex} of {totalItems}
      </Text>
      
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, !hasPrevPage && styles.buttonDisabled]}
          onPress={onPrevPage}
          disabled={!hasPrevPage}
        >
          <Ionicons 
            name="chevron-back" 
            size={DesignTokens.iconSize.md} 
            color={hasPrevPage ? Colors.primary : Colors.textMuted} 
          />
        </TouchableOpacity>

        <Text style={styles.pageText}>
          Page {currentPage} of {totalPages}
        </Text>

        <TouchableOpacity
          style={[styles.button, !hasNextPage && styles.buttonDisabled]}
          onPress={onNextPage}
          disabled={!hasNextPage}
        >
          <Ionicons 
            name="chevron-forward" 
            size={DesignTokens.iconSize.md} 
            color={hasNextPage ? Colors.primary : Colors.textMuted} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  info: {
    fontSize: DesignTokens.fontSize.sm,
    color: Colors.textMuted,
    fontWeight: DesignTokens.fontWeight.medium,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.md,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: DesignTokens.borderRadius.sm,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  pageText: {
    fontSize: DesignTokens.fontSize.md,
    color: Colors.text,
    fontWeight: DesignTokens.fontWeight.semibold,
    minWidth: 80,
    textAlign: 'center',
  },
});
