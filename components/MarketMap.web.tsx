import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MarketMap() {
  return (
    <View style={styles.webPlaceholder}>
      <Text style={styles.webTitle}>Map Preview (Mobile Only)</Text>
      <Text style={styles.webSubTitle}>Download the APK or use an emulator to see live interactive maps.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webPlaceholder: { flex: 1, backgroundColor: '#f0f4f8', justifyContent: 'center', alignItems: 'center', padding: 40 },
  webTitle: { fontSize: 24, fontWeight: 'bold', color: '#1B5E20', textAlign: 'center' },
  webSubTitle: { fontSize: 16, color: '#666', marginTop: 10, textAlign: 'center' },
});
