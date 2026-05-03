import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, Dimensions } from 'react-native';
import { Colors } from '../constants/colors';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function MaintenanceModeScreen() {
  const { message } = useLocalSearchParams<{ message?: string }>();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <View style={styles.badgeContainer}>
            <Ionicons name="construct" size={width * 0.3} color={Colors.white} />
          </View>
        </View>

        <Text style={styles.title}>Woof! We're Updating</Text>

        <View style={styles.card}>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>System Update in Progress</Text>
          </View>

          <Text style={styles.message}>
            {message || "My Building app is currently undergoing scheduled maintenance to improve our services.\n\nPlease check back soon!"}
          </Text>
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footer}>We'll be back shortly!</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  imageContainer: {
    width: width * 0.7,
    height: width * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  badgeContainer: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: (width * 0.6) / 2,
    backgroundColor: Colors.primary,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    padding: 28,
    borderRadius: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)', // For web, but nice to have in mind
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBDF51', // A bright yellow for status
    marginRight: 8,
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  message: {
    fontSize: 17,
    lineHeight: 26,
    color: Colors.white,
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.95,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 40,
  },
  footer: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
});
