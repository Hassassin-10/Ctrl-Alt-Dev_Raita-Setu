import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export default function TrackMap({ 
    markets, 
}: any) {
  return (
    <MapView 
      style={StyleSheet.absoluteFillObject}
      initialRegion={{
          latitude: 12.9716,
          longitude: 77.5946,
          latitudeDelta: 0.8,
          longitudeDelta: 0.8,
      }}
      scrollEnabled={false}
    >
      {markets.map((market: any, idx: number) => (
          <Marker 
              key={market.id || idx} 
              coordinate={market.coords}
              title={market.market}
              description={`₹${market.modal_price}/kg`}
          >
              <View style={[styles.customMarker, { backgroundColor: market.color, borderColor: '#ffffff', borderWidth: 2 }]}>
                  <Text style={styles.markerText}>₹{market.modal_price.toFixed(0)}</Text>
              </View>
          </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  customMarker: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
