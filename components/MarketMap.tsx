import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export default function MarketMap({ 
    region, 
    sortedMarkets, 
    selectedCrop, 
    bestMarket, 
    setSelectedMarket, 
    mapRef 
}: any) {
  return (
    <MapView 
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_GOOGLE}
      region={region}
      showsUserLocation={true}
    >
      {sortedMarkets.map((m: any) => {
        const price = m.prices[selectedCrop] || 0;
        const isBest = m.id === bestMarket?.id;
        if (price === 0) return null;
        return (
          <Marker 
            key={m.id}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            onPress={() => setSelectedMarket(m)}
          >
            <View style={[styles.priceMarker, isBest && styles.bestMarker]}>
               <Text style={styles.markerPrice}>₹{price}</Text>
               <View style={[styles.markerTail, isBest && { borderTopColor: '#00C853' }]} />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  priceMarker: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  bestMarker: {
    borderColor: '#00C853',
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  markerPrice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  markerTail: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ddd',
    marginTop: -1,
  },
});
