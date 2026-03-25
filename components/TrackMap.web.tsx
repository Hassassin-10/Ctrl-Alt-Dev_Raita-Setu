import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TrackMap() {
  return (
    <View style={styles.webPlaceholder}>
      <Text style={styles.webTitle}>Interactive Map Unavailable</Text>
      <Text style={styles.webSubTitle}>Download the mobile app to view live Mandi locations on the map.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webPlaceholder: { flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', padding: 20 },
  webTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  webSubTitle: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8 },
});
