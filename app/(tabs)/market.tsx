import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, Platform, TextInput, FlatList, Linking, Alert, SafeAreaView, ActivityIndicator, Modal, Image } from 'react-native';
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
import * as ImagePicker from 'expo-image-picker';
import { db, storage } from '@/services/firebase';
import { collection, addDoc, onSnapshot, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const { width, height } = Dimensions.get('window');

const CROPS = ['Onion', 'Tomato', 'Potato', 'Rice', 'Wheat', 'Maize'];

// --- Enhanced Market Data ---
const MARKETS = [
  {
    id: '1',
    name: 'Yeshwanthpur APMC',
    type: 'APMC Market',
    lat: 13.0234,
    lng: 77.5501,
    hours: '04:00 AM - 06:00 PM',
    contact: '+91 80 2337 1234',
    prices: { 'Onion': 24, 'Tomato': 12, 'Potato': 15, 'Rice': 38, 'Wheat': 26, 'Maize': 22 },
    distance: 3.2,
    color: '#00C853',
    icon: 'leaf.fill'
  },
  {
    id: '2',
    name: 'K.R. Puram Mandi',
    type: 'Local Mandi',
    lat: 13.0112,
    lng: 77.7058,
    hours: '05:00 AM - 12:00 PM',
    contact: '+91 80 2568 5678',
    prices: { 'Onion': 22, 'Tomato': 14, 'Potato': 16, 'Rice': 39, 'Wheat': 27, 'Maize': 20 },
    distance: 12.4,
    color: '#2962FF',
    icon: 'cart.fill'
  },
  {
    id: '3',
    name: 'Malleswaram Market',
    type: 'Local Mandi',
    lat: 12.9984,
    lng: 77.5714,
    hours: '06:00 AM - 10:00 PM',
    contact: '+91 99000 11223',
    prices: { 'Onion': 25, 'Tomato': 15, 'Potato': 15, 'Rice': 41, 'Wheat': 28, 'Maize': 24 },
    distance: 5.8,
    color: '#2962FF',
    icon: 'cart.fill'
  },
];

export default function IntegratedMarketDiscovery() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);

  const [selectedCrop, setSelectedCrop] = useState('Onion');
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [region, setRegion] = useState({
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.2,
    longitudeDelta: 0.2,
  });

  const [liveMarkets, setLiveMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketTab, setMarketTab] = useState<'Mandi' | 'Rental'>('Mandi');
  
  // Machinery Specific State
  const { user, role, t } = useAuth();
  const [machinery, setMachinery] = useState<any[]>([]);
  const [machineModalVisible, setMachineModalVisible] = useState(false);
  const [newMachine, setNewMachine] = useState({ name: '', type: 'Tractor', price: '', image: null as string | null });
  const [uploading, setUploading] = useState(false);

  // Fallback for missing prices in real data
  const getDisplayPrice = (market: any, crop: string) => {
    if (market.prices && market.prices[crop]) return market.prices[crop];
    return "N/A";
  };

  const fetchLiveMarketData = async (userState: string = 'Karnataka') => {
    setLoading(true);
    try {
      const API_KEY = process.env.EXPO_PUBLIC_OGD_API_KEY;
      const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
      
      if (!API_KEY) {
          console.error("[Market] API_KEY is missing! Check .env");
          throw new Error("Missing API Key");
      }

      const url = `https://api.data.gov.in/resource/${RESOURCE_ID}?api-key=${API_KEY}&format=json&limit=20&filters[state.keyword]=${encodeURIComponent(userState)}&filters[commodity.keyword]=${encodeURIComponent(selectedCrop)}`;
      
      console.log(`[Market] Fetching live data: ${url}`);
      const res = await fetch(url, {
          method: 'GET',
          headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
          }
      });
      console.log(`[Market] Response Status: ${res.status}`);
      const data = await res.json();

      if (data.records && data.records.length > 0) {
        const mapped = data.records.map((r: any, idx: number) => {
          // Check if we have coordinate data for this market in our mock list
          const existing = MARKETS.find(m => m.name.toLowerCase().includes(r.market.toLowerCase()));
          
          return {
            id: `live-${idx}`,
            name: r.market,
            type: 'APMC Market',
            lat: existing ? existing.lat : region.latitude + (Math.random() - 0.5) * 0.2,
            lng: existing ? existing.lng : region.longitude + (Math.random() - 0.5) * 0.2,
            hours: '04:00 AM - 06:00 PM',
            contact: '+91 80 2337 1234',
            prices: { [selectedCrop]: parseInt(r.modal_price) }, // Store as per quintal for the list
            distance: existing ? existing.distance : Math.floor(Math.random() * 30) + 5,
            color: '#00C853',
            icon: 'leaf.fill'
          };
        });
        setLiveMarkets(mapped);
      } else {
         // If no live results, use mock data filtered for this crop
         setLiveMarkets(MARKETS);
      }
    } catch (e) {
      console.error("[Market] API Error:", e);
      setLiveMarkets(MARKETS);
    } finally {
      setLoading(false);
    }
  };

  const sortedMarkets = useMemo(() => {
    return [...liveMarkets].sort((a, b) => (b.prices[selectedCrop] || 0) - (a.prices[selectedCrop] || 0));
  }, [liveMarkets, selectedCrop]);

  const bestMarket = sortedMarkets[0];

  useEffect(() => {
    if (Platform.OS === 'web') {
        fetchLiveMarketData('Karnataka');
        return;
    }
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            fetchLiveMarketData('Karnataka');
            return;
        }
        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setRegion(prev => ({ ...prev, latitude: location.coords.latitude, longitude: location.coords.longitude }));
        
        const address = await Location.reverseGeocodeAsync(location.coords);
        const userState = address[0]?.region || 'Karnataka';
        fetchLiveMarketData(userState);
      } catch (e) { 
          console.warn(e); 
          fetchLiveMarketData('Karnataka');
      }
    })();
  }, [selectedCrop]);

  const selectMarket = (m: any) => {
    setSelectedMarket(m);
    setRegion({
      ...region,
      latitude: m.lat,
      longitude: m.lng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
  };

  useEffect(() => {
    const q = collection(db, 'machinery');
    return onSnapshot(q, (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMachinery(items);
    });
  }, []);

  const pickMachineImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, quality: 0.5,
    });
    if (!result.canceled) setNewMachine(p => ({ ...p, image: result.assets[0].uri }));
  };

  const handlePostMachine = async () => {
    if (!user || !newMachine.name || !newMachine.price) return;
    setUploading(true);
    try {
        let imageUrl = '';
        if (newMachine.image) {
            const blob = await (await fetch(newMachine.image)).blob();
            const storageRef = ref(storage, `machinery/${user.uid}/${Date.now()}`);
            await uploadBytes(storageRef, blob);
            imageUrl = await getDownloadURL(storageRef);
        }

        await addDoc(collection(db, 'machinery'), {
            ownerId: user.uid,
            ownerName: user.displayName || 'Owner',
            name: newMachine.name,
            type: newMachine.type,
            price: newMachine.price,
            image: imageUrl,
            location: { lat: region.latitude, lng: region.longitude },
            createdAt: new Date().toISOString()
        });
        setMachineModalVisible(false);
        setNewMachine({ name: '', type: 'Tractor', price: '', image: null });
        Alert.alert("Success", "Machine listed successfully!");
    } catch (e: any) { Alert.alert("Upload Error", e.message); }
    finally { setUploading(false); }
  };

  const handleDestinationSearch = async () => {
    if (searchQuery.length < 3) return;
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results.length > 0) {
        setRegion({
          ...region,
          latitude: results[0].latitude,
          longitude: results[0].longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
      }
    } catch (e) { Alert.alert("Search Error", "Location not found."); }
  };

  return (
    <View style={styles.container}>
      {/* 1. Map Layer */}
      <View style={StyleSheet.absoluteFillObject}>
        {Platform.OS === 'web' ? (
          <View style={styles.webPlaceholder}><Text style={styles.webTitle}>Map Preview (Mobile Only)</Text></View>
        ) : (
          <MapView 
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            region={region}
            showsUserLocation={true}
          >
            {sortedMarkets.map(m => {
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
        )}
      </View>

      {/* Loading Overlay */}
      {loading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 }]}>
           <ActivityIndicator size="large" color={c.primary} />
           <Text style={{ marginTop: 10, color: c.primary, fontWeight: 'bold' }}>Loading Live Prices...</Text>
        </View>
      )}

      {/* 2. Overlays Layer */}
      <View style={styles.overlayLayer}>
        {/* Top Search & Crop Selector */}
        <View style={[styles.headerArea, { paddingTop: insets.top + 10 }]}>
           <BlurView intensity={80} tint="light" style={styles.searchBar}>
             <IconSymbol name="magnifyingglass" size={18} color="#666" style={{ marginRight: 8 }} />
             <TextInput 
               placeholder="Search city/mandi..." 
               style={styles.searchInput}
               value={searchQuery}
               onChangeText={setSearchQuery}
               onSubmitEditing={handleDestinationSearch}
             />
             <TouchableOpacity onPress={handleDestinationSearch}><IconSymbol name="arrow.right.circle.fill" size={24} color={c.primary} /></TouchableOpacity>
           </BlurView>

           <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cropSelector}>
             {CROPS.map(crop => (
               <TouchableOpacity 
                 key={crop} 
                 style={[styles.cropChip, selectedCrop === crop && { backgroundColor: c.primary, borderColor: c.primary }]}
                 onPress={() => setSelectedCrop(crop)}
               >
                 <Text style={[styles.cropChipText, selectedCrop === crop && { color: '#fff' }]}>{crop}</Text>
               </TouchableOpacity>
             ))}
           </ScrollView>

           {bestMarket && (
             <LinearGradient colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.8)']} style={styles.aiHint}>
                <IconSymbol name="sparkles" size={16} color="#FFD700" />
                <Text style={styles.aiHintText}>Best: <Text style={{ fontWeight: 'bold', color: '#00C853' }}>{bestMarket.name}</Text> (₹{bestMarket.prices[selectedCrop as keyof typeof bestMarket.prices]})</Text>
             </LinearGradient>
           )}
        </View>

        {/* Floating Controls */}
        <View style={styles.mapControls}>
             <TouchableOpacity style={styles.controlBtn} onPress={() => setRegion({ latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.2, longitudeDelta: 0.2 })}>
                <BlurView intensity={80} tint="light" style={styles.controlBlur}>
                  <IconSymbol name="location.fill" size={22} color={c.primary} />
                </BlurView>
             </TouchableOpacity>

             <View style={styles.legendWrapper}>
                <BlurView intensity={80} tint="light" style={styles.legendBlur}>
                   <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#00C853' }]} /><Text style={styles.legendTxt}>APMC</Text></View>
                   <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#2962FF' }]} /><Text style={styles.legendTxt}>Mandi</Text></View>
                </BlurView>
             </View>
        </View>

        {/* Bottom Scrollable Price List / Machine List */}
        <View style={styles.bottomSection}>
           <Text style={styles.sectionTitle}>{marketTab === 'Mandi' ? `Live Market Prices (${selectedCrop})` : 'Available Machinery nearby'}</Text>
           {marketTab === 'Mandi' ? (
               <FlatList 
                  data={sortedMarkets} horizontal showsHorizontalScrollIndicator={false} keyExtractor={item => item.id}
                  contentContainerStyle={{ paddingHorizontal: 20 }}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity style={[styles.marketMiniCard, selectedMarket?.id === item.id && { borderColor: c.primary, borderWidth: 2 }, index === 0 && { backgroundColor: '#E8F5E9' }]} onPress={() => selectMarket(item)}>
                        <View style={[styles.rankDot, { backgroundColor: index === 0 ? '#00C853' : '#eee' }]}><Text style={{ color: index === 0 ? '#fff' : '#666', fontSize: 10, fontWeight: 'bold' }}>#{index + 1}</Text></View>
                        <Text style={styles.miniName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.miniPrice}>₹{item.prices[selectedCrop as keyof typeof item.prices]}</Text>
                        <Text style={styles.miniUnit}>per quintal</Text>
                    </TouchableOpacity>
                  )}
               />
           ) : (
                <View>
                    <FlatList 
                        data={machinery} horizontal showsHorizontalScrollIndicator={false} keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingHorizontal: 20 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.marketMiniCard}>
                                <Image source={{ uri: item.image || 'https://via.placeholder.com/150' }} style={styles.miniMachineImg} />
                                <Text style={styles.miniName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.miniPrice}>₹{item.price}<Text style={{ fontSize: 10 }}>/h</Text></Text>
                            </TouchableOpacity>
                        )}
                    />
                    {role === 'MachineryOwner' && (
                        <TouchableOpacity style={styles.fabBtn} onPress={() => setMachineModalVisible(true)}>
                            <IconSymbol name="plus" size={24} color="#fff" />
                            <Text style={styles.fabText}>Add Machine</Text>
                        </TouchableOpacity>
                    )}
                </View>
           )}
        </View>
      </View>

      {/* Selected Details Drawer */}
      {selectedMarket && (
         <View style={styles.drawerContainer}>
            <BlurView intensity={100} tint="light" style={styles.drawerCard}>
               <View style={styles.drawerHeader}>
                  <View>
                     <Text style={styles.drawerTitle}>{selectedMarket.name}</Text>
                     <Text style={styles.drawerMeta}>{selectedMarket.type} • {selectedMarket.distance} km</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedMarket(null)}><IconSymbol name="xmark.circle.fill" size={28} color="#ccc" /></TouchableOpacity>
               </View>
               <View style={styles.drawerActions}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#00C853' }]} onPress={() => Linking.openURL(`tel:${selectedMarket.contact}`)}>
                     <IconSymbol name="phone.fill" size={18} color="#fff" />
                     <Text style={styles.actionBtnText}>Call Mandi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: c.primary }]} onPress={() => Linking.openURL(`geo:${selectedMarket.lat},${selectedMarket.lng}`)}>
                     <IconSymbol name="location.fill" size={18} color="#fff" />
                     <Text style={styles.actionBtnText}>Directions</Text>
                  </TouchableOpacity>
               </View>
            </BlurView>
         </View>
      )}

      {/* Post Machine Modal */}
      <Modal visible={machineModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
              <BlurView intensity={100} tint="light" style={styles.modalSheet}>
                  <Text style={styles.modalTitle}>List Your Machinery</Text>
                  <TouchableOpacity onPress={pickMachineImage} style={styles.imagePickerBtn}>
                      {newMachine.image ? <Image source={{ uri: newMachine.image }} style={styles.previewImg} /> : <IconSymbol name="camera.fill" size={40} color="#999" />}
                  </TouchableOpacity>
                  <TextInput placeholder="Machine Name (e.g. John Deere Tractor)" style={styles.modalInp} value={newMachine.name} onChangeText={t => setNewMachine(p => ({ ...p, name: t }))} />
                  <TextInput placeholder="Price per hour (₹)" style={styles.modalInp} keyboardType="numeric" value={newMachine.price} onChangeText={t => setNewMachine(p => ({ ...p, price: t }))} />
                  <View style={styles.modalBtns}>
                      <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#eee' }]} onPress={() => setMachineModalVisible(false)}><Text>Cancel</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtn, { backgroundColor: c.primary }]} onPress={handlePostMachine} disabled={uploading}>
                          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Post Listing</Text>}
                      </TouchableOpacity>
                  </View>
              </BlurView>
          </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlayLayer: { flex: 1, paddingBottom: 100 },
  headerArea: { paddingHorizontal: 20 },
  searchBar: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  searchInput: { flex: 1, fontSize: 16 },
  cropSelector: { marginTop: 15, flexDirection: 'row' },
  cropChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', marginRight: 10, borderWidth: 1, borderColor: '#ddd' },
  cropChipText: { fontWeight: 'bold', color: '#666' },
  aiHint: { marginTop: 15, padding: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E8F5E9', alignSelf: 'flex-start' },
  aiHintText: { fontSize: 13, color: '#444' },
  priceMarker: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 2, borderColor: '#2962FF', alignItems: 'center', elevation: 5 },
  bestMarker: { borderColor: '#00C853', transform: [{ scale: 1.1 }] },
  markerPrice: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  markerTail: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#2962FF', position: 'absolute', bottom: -10 },
  mapControls: { position: 'absolute', top: 220, right: 20, zIndex: 10, alignItems: 'flex-end' },
  controlBtn: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', elevation: 5 },
  controlBlur: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  legendWrapper: { marginTop: 15, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  legendBlur: { padding: 8, gap: 5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 10, fontWeight: 'bold' },
  bottomSection: { position: 'absolute', bottom: 50, left: 0, right: 0 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff', marginLeft: 25, marginBottom: 15, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  marketMiniCard: { width: 160, backgroundColor: 'rgba(255,255,255,0.95)', padding: 15, borderRadius: 20, marginRight: 15, elevation: 10 },
  rankDot: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  miniName: { fontSize: 13, fontWeight: 'bold' },
  miniPrice: { fontSize: 20, fontWeight: '900', color: '#00C853', marginTop: 5 },
  miniUnit: { fontSize: 10, color: '#999' },
  drawerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  drawerCard: { padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden', elevation: 20, paddingBottom: 40 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  drawerTitle: { fontSize: 20, fontWeight: 'bold' },
  drawerMeta: { fontSize: 14, color: '#666', marginTop: 5 },
  drawerActions: { flexDirection: 'row', gap: 15, marginTop: 25 },
  actionBtn: { flex: 1, height: 50, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  actionBtnText: { color: '#fff', fontWeight: 'bold' },
  webPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eee' },
  webTitle: { fontSize: 20, fontWeight: 'bold' },
  tabSwitcher: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, padding: 4, marginTop: 15 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 16 },
  activeTab: { backgroundColor: '#fff' },
  tabBtnText: { fontSize: 13, fontWeight: 'bold', color: '#666' },
  activeTabText: { color: '#111' },
  miniMachineImg: { width: '100%', height: 60, borderRadius: 10, marginBottom: 5 },
  fabBtn: { position: 'absolute', bottom: 180, right: 20, backgroundColor: '#00C853', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 10 },
  fabText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#fff', minHeight: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  imagePickerBtn: { width: '100%', height: 150, backgroundColor: '#f5f5f5', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 15, overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%' },
  modalInp: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 15, marginBottom: 12, fontSize: 16 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBtn: { flex: 1, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
});
