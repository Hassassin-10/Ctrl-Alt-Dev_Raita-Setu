import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, Platform, TextInput, FlatList, Linking, Alert, SafeAreaView, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useState, useEffect, useRef, useMemo } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');

const CROPS = ['Onion', 'Tomato', 'Potato', 'Rice', 'Wheat', 'Maize'];

const MARKETS: Array<{ id: string, name: string, type: string, lat: number, lng: number, prices: Record<string, number>, contact: string }> = [
  // ━━━ BANGALORE REGION (10) ━━━
  { id: 'b1', name: 'Yeshwanthpur APMC', type: 'APMC Market', lat: 13.0234, lng: 77.5501, prices: { 'Onion': 1125, 'Tomato': 1090, 'Potato': 1542, 'Rice': 3833, 'Wheat': 3026, 'Maize': 1860 }, contact: '+91 80 2337 1234' },
  { id: 'b2', name: 'K.R. Puram Mandi', type: 'Local Mandi', lat: 13.0112, lng: 77.7058, prices: { 'Onion': 1050, 'Tomato': 1200, 'Potato': 1480, 'Rice': 3900, 'Wheat': 2950, 'Maize': 1920 }, contact: '+91 80 2568 5678' },
  { id: 'b3', name: 'Malleswaram Market', type: 'Local Mandi', lat: 12.9984, lng: 77.5714, prices: { 'Onion': 1180, 'Tomato': 1050, 'Potato': 1600, 'Rice': 3750, 'Wheat': 3100, 'Maize': 1800 }, contact: '+91 99000 11223' },
  { id: 'b4', name: 'Ramanagara APMC', type: 'APMC Market', lat: 12.7233, lng: 77.2764, prices: { 'Onion': 1100, 'Tomato': 1400, 'Potato': 1520, 'Rice': 4100, 'Wheat': 2880, 'Maize': 2000 }, contact: '+91 80 2727 4455' },
  { id: 'b5', name: 'Channapatna Mandi', type: 'Local Mandi', lat: 12.6465, lng: 77.1996, prices: { 'Onion': 1080, 'Tomato': 1350, 'Potato': 1490, 'Rice': 4050, 'Wheat': 2920, 'Maize': 1950 }, contact: '+91 80 2765 1122' },
  { id: 'b6', name: 'Magadi Mandi', type: 'Local Mandi', lat: 12.9602, lng: 77.2272, prices: { 'Onion': 1110, 'Tomato': 1280, 'Potato': 1550, 'Rice': 3880, 'Wheat': 3010, 'Maize': 1890 }, contact: '+91 80 2772 3344' },
  { id: 'b7', name: 'Kanakapura APMC', type: 'APMC Market', lat: 12.5513, lng: 77.4208, prices: { 'Onion': 1040, 'Tomato': 1450, 'Potato': 1460, 'Rice': 4200, 'Wheat': 2850, 'Maize': 2050 }, contact: '+91 80 2755 6677' },
  { id: 'b8', name: 'Doddaballapura Mandi', type: 'Local Mandi', lat: 13.2925, lng: 77.5336, prices: { 'Onion': 1150, 'Tomato': 1180, 'Potato': 1580, 'Rice': 3780, 'Wheat': 3080, 'Maize': 1830 }, contact: '+91 80 2766 8899' },
  { id: 'b9', name: 'Devanahalli APMC', type: 'APMC Market', lat: 13.2483, lng: 77.7126, prices: { 'Onion': 1170, 'Tomato': 1020, 'Potato': 1610, 'Rice': 3820, 'Wheat': 3120, 'Maize': 1810 }, contact: '+91 80 2767 1122' },
  { id: 'b10', name: 'Nelamangala Mandi', type: 'Local Mandi', lat: 13.0975, lng: 77.3934, prices: { 'Onion': 1090, 'Tomato': 1120, 'Potato': 1510, 'Rice': 3930, 'Wheat': 2970, 'Maize': 1880 }, contact: '+91 80 2773 4455' },

  // ━━━ MYSORE REGION (10) ━━━
  { id: 'm1', name: 'Mysuru Mandi', type: 'Local Mandi', lat: 12.2958, lng: 76.6394, prices: { 'Onion': 1180, 'Tomato': 1050, 'Potato': 1600, 'Rice': 3750, 'Wheat': 3100, 'Maize': 1800 }, contact: '+91 821 245 5678' },
  { id: 'm2', name: 'Nanjangud APMC', type: 'APMC Market', lat: 12.1158, lng: 76.6800, prices: { 'Onion': 1160, 'Tomato': 1080, 'Potato': 1580, 'Rice': 3800, 'Wheat': 3050, 'Maize': 1820 }, contact: '+91 8221 223344' },
  { id: 'm3', name: 'Hunsur Mandi', type: 'Local Mandi', lat: 12.3088, lng: 76.2908, prices: { 'Onion': 1200, 'Tomato': 1020, 'Potato': 1620, 'Rice': 3700, 'Wheat': 3150, 'Maize': 1780 }, contact: '+91 8222 255667' },
  { id: 'm4', name: 'T.Narasipura Mandi', type: 'Local Mandi', lat: 12.2106, lng: 76.8994, prices: { 'Onion': 1140, 'Tomato': 1100, 'Potato': 1560, 'Rice': 3850, 'Wheat': 3000, 'Maize': 1850 }, contact: '+91 8227 266778' },
  { id: 'm5', name: 'K.R.Nagar APMC', type: 'APMC Market', lat: 12.4411, lng: 76.3814, prices: { 'Onion': 1155, 'Tomato': 1060, 'Potato': 1575, 'Rice': 3825, 'Wheat': 3025, 'Maize': 1810 }, contact: '+91 8223 277889' },
  { id: 'm6', name: 'Periyapatna Mandi', type: 'Local Mandi', lat: 12.3411, lng: 76.0967, prices: { 'Onion': 1220, 'Tomato': 1000, 'Potato': 1640, 'Rice': 3680, 'Wheat': 3180, 'Maize': 1750 }, contact: '+91 8223 288990' },
  { id: 'm7', name: 'Gundlupet Mandi', type: 'Local Mandi', lat: 11.8083, lng: 76.6833, prices: { 'Onion': 1195, 'Tomato': 1035, 'Potato': 1615, 'Rice': 3725, 'Wheat': 3125, 'Maize': 1795 }, contact: '+91 8229 299001' },
  { id: 'm8', name: 'Saragur Mandi', type: 'Local Mandi', lat: 12.0433, lng: 76.3811, prices: { 'Onion': 1210, 'Tomato': 1010, 'Potato': 1630, 'Rice': 3690, 'Wheat': 3170, 'Maize': 1760 }, contact: '+91 8225 211223' },
  { id: 'm9', name: 'H.D. Kote Mandi', type: 'Local Mandi', lat: 12.0833, lng: 76.3333, prices: { 'Onion': 1205, 'Tomato': 1015, 'Potato': 1625, 'Rice': 3715, 'Wheat': 3165, 'Maize': 1775 }, contact: '+91 8225 222334' },
  { id: 'm10', name: 'Bannur Mandi', type: 'Local Mandi', lat: 12.3333, lng: 76.8667, prices: { 'Onion': 1130, 'Tomato': 1110, 'Potato': 1530, 'Rice': 3880, 'Wheat': 2980, 'Maize': 1870 }, contact: '+91 8227 233445' },

  // ━━━ HASSAN REGION (10) ━━━
  { id: 'h1', name: 'Hassan APMC', type: 'APMC Market', lat: 13.0033, lng: 76.1004, prices: { 'Onion': 1080, 'Tomato': 1150, 'Potato': 1500, 'Rice': 3900, 'Wheat': 2950, 'Maize': 1900 }, contact: '+91 8172 265432' },
  { id: 'h2', name: 'Arsikere APMC', type: 'APMC Market', lat: 13.3135, lng: 76.2570, prices: { 'Onion': 1060, 'Tomato': 1220, 'Potato': 1480, 'Rice': 3950, 'Wheat': 2900, 'Maize': 1980 }, contact: '+91 8174 233445' },
  { id: 'h3', name: 'Belur Mandi', type: 'Local Mandi', lat: 13.1611, lng: 75.8601, prices: { 'Onion': 1100, 'Tomato': 1120, 'Potato': 1520, 'Rice': 3850, 'Wheat': 3010, 'Maize': 1880 }, contact: '+91 8177 244556' },
  { id: 'h4', name: 'Charayapatna APMC', type: 'APMC Market', lat: 12.8996, lng: 76.3905, prices: { 'Onion': 1055, 'Tomato': 1180, 'Potato': 1470, 'Rice': 4000, 'Wheat': 2850, 'Maize': 2020 }, contact: '+91 8176 255667' },
  { id: 'h5', name: 'Holenarispura Mandi', type: 'Local Mandi', lat: 12.7820, lng: 76.2309, prices: { 'Onion': 1090, 'Tomato': 1140, 'Potato': 1510, 'Rice': 3920, 'Wheat': 2970, 'Maize': 1920 }, contact: '+91 8175 266778' },
  { id: 'h6', name: 'Arkalgud Mandi', type: 'Local Mandi', lat: 12.7633, lng: 76.0617, prices: { 'Onion': 1110, 'Tomato': 1110, 'Potato': 1530, 'Rice': 3880, 'Wheat': 3030, 'Maize': 1870 }, contact: '+91 8175 277889' },
  { id: 'h7', name: 'Sakleshpur Mandi', type: 'Local Mandi', lat: 12.9431, lng: 75.7865, prices: { 'Onion': 1130, 'Tomato': 1090, 'Potato': 1560, 'Rice': 3800, 'Wheat': 3100, 'Maize': 1820 }, contact: '+91 8173 288990' },
  { id: 'h8', name: 'Alur Mandi', type: 'Local Mandi', lat: 12.9833, lng: 75.9833, prices: { 'Onion': 1120, 'Tomato': 1100, 'Potato': 1540, 'Rice': 3830, 'Wheat': 3070, 'Maize': 1850 }, contact: '+91 8172 299001' },
  { id: 'h9', name: 'Konanur Mandi', type: 'Local Mandi', lat: 12.6333, lng: 76.0167, prices: { 'Onion': 1105, 'Tomato': 1125, 'Potato': 1515, 'Rice': 3915, 'Wheat': 3005, 'Maize': 1895 }, contact: '+91 8175 211223' },
  { id: 'h10', name: 'Javagal Mandi', type: 'Local Mandi', lat: 13.3, lng: 76.05, prices: { 'Onion': 1075, 'Tomato': 1205, 'Potato': 1485, 'Rice': 3945, 'Wheat': 2915, 'Maize': 1975 }, contact: '+91 8174 222334' },
];

export default function IntegratedMarketDiscovery() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const { t } = useAuth();

  const [selectedCrop, setSelectedCrop] = useState('Onion');
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [region, setRegion] = useState({
    latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.2, longitudeDelta: 0.2,
  });

  const [loading, setLoading] = useState(false);

  // Filter and Sort Markets locally based on manual data
  const sortedMarkets = useMemo(() => {
    let filtered = MARKETS.filter(m => 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return filtered.sort((a, b) => ((a.prices as any)[selectedCrop] || 0) - ((b.prices as any)[selectedCrop] || 0));
  }, [selectedCrop, searchQuery]);

  const bestMarket = sortedMarkets[0];

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          if (location) {
            setRegion(prev => ({ ...prev, latitude: location.coords.latitude, longitude: location.coords.longitude }));
          }
        }
      } catch (e) {
        console.warn("[Market] GPS Permission Error");
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      {/* Map Layer */}
      <View style={StyleSheet.absoluteFillObject}>
        {Platform.OS !== 'web' && (
          <MapView ref={mapRef} style={StyleSheet.absoluteFillObject} region={region} showsUserLocation>
            {sortedMarkets.map(m => (
              <Marker key={m.id} coordinate={{ latitude: m.lat, longitude: m.lng }} onPress={() => setSelectedMarket(m)}>
                <View style={[styles.priceMarker, m.id === bestMarket?.id && styles.bestMarker]}>
                  <Text style={styles.markerLabel}>{m.name.includes('APMC') ? 'APMC' : 'Mandi'}</Text>
                  <Text style={styles.markerPrice}>₹{(m.prices as any)[selectedCrop]}</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        )}
      </View>

      {/* Overlays */}
      <View style={styles.overlay}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <BlurView intensity={80} tint="light" style={styles.searchBar}>
            <IconSymbol name="magnifyingglass" size={18} color="#666" style={{ marginRight: 8 }} />
            <TextInput placeholder="Search mandi..." style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} />
          </BlurView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cropSelector}>
            {CROPS.map(c => (
              <TouchableOpacity key={c} style={[styles.cropChip, selectedCrop === c && styles.activeChip]} onPress={() => setSelectedCrop(c)}>
                <Text style={[styles.cropText, selectedCrop === c && { color: '#fff' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.bottomList}>
          <Text style={styles.sectionTitle}>Live Prices - {selectedCrop}</Text>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <FlatList data={sortedMarkets} horizontal keyExtractor={item => item.id} contentContainerStyle={{ paddingLeft: 25 }} renderItem={({ item, index }) => (
              <TouchableOpacity style={[styles.priceCard, index === 0 && { backgroundColor: '#E8F5E9' }]} onPress={() => { setSelectedMarket(item); setRegion({ ...region, latitude: item.lat, longitude: item.lng }); }}>
                <Text style={styles.miniName}>{item.name}</Text>
                <Text style={styles.miniPrice}>₹{(item.prices as any)[selectedCrop]}</Text>
                <Text style={{ fontSize: 10, color: '#999' }}>per quintal</Text>
              </TouchableOpacity>
            )} />
          )}
        </View>
      </View>

      {/* Details Modal */}
      {selectedMarket && (
        <View style={styles.drawer}>
          <BlurView intensity={100} style={styles.drawerInner}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.drawerTitle}>{selectedMarket.name}</Text>
              <TouchableOpacity onPress={() => setSelectedMarket(null)}><IconSymbol name="xmark.circle.fill" size={28} color="#ccc" /></TouchableOpacity>
            </View>

            <View style={styles.priceInfoRow}>
              <Text style={styles.priceLabel}>{selectedCrop} Price:</Text>
              <Text style={styles.priceValue}>₹{(selectedMarket.prices as any)[selectedCrop]}</Text>
              <Text style={styles.priceUnit}>/ quintal</Text>
            </View>
            <View style={styles.drawerActions}>
              <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${selectedMarket.contact}`)}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Call Mandi</Text></TouchableOpacity>
              <TouchableOpacity style={styles.dirBtn} onPress={() => Linking.openURL(`geo:${selectedMarket.lat},${selectedMarket.lng}`)}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Directions</Text></TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, paddingBottom: 120 },
  header: { paddingHorizontal: 20 },
  searchBar: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, overflow: 'hidden' },
  searchInput: { flex: 1, fontSize: 16 },
  cropSelector: { marginTop: 15 },
  cropChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 10 },
  activeChip: { backgroundColor: '#2E7D32' },
  cropText: { fontWeight: 'bold', color: '#666' },
  priceMarker: { backgroundColor: '#fff', padding: 6, borderRadius: 8, borderWidth: 2, borderColor: '#2962FF', alignItems: 'center' },
  bestMarker: { borderColor: '#00C853' },
  markerLabel: { fontSize: 8, fontWeight: 'bold', color: '#666', marginBottom: -2 },
  markerPrice: { fontWeight: 'bold', fontSize: 12 },
  bottomList: { position: 'absolute', bottom: 30, left: 0, right: 0 },
  sectionTitle: { color: '#fff', fontWeight: 'bold', marginLeft: 25, marginBottom: 10, textShadowColor: '#000', textShadowRadius: 2 },
  priceCard: { width: 150, backgroundColor: '#fff', padding: 15, borderRadius: 20, marginRight: 15 },
  miniName: { fontSize: 13, fontWeight: 'bold' },
  miniPrice: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32', marginTop: 4 },
  drawer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  drawerInner: { backgroundColor: '#fff', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  drawerTitle: { fontSize: 20, fontWeight: 'bold' },
  priceInfoRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10, gap: 6 },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32' },
  priceUnit: { fontSize: 12, color: '#999' },
  drawerActions: { flexDirection: 'row', gap: 15, marginTop: 15 },
  callBtn: { flex: 1, height: 50, backgroundColor: '#00C853', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  dirBtn: { flex: 1, height: 50, backgroundColor: '#2E7D32', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
});
