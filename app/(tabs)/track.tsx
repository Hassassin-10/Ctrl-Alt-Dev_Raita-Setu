import { StyleSheet, View, Text, ScrollView, Dimensions, TouchableOpacity, Animated, ActivityIndicator, TextInput, Linking, Alert } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useRef, useEffect } from 'react';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useAuth } from '@/context/AuthContext';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

// Fallback Mock Data in case API is down or Key is missing
const FALLBACK_MARKETS = [
    // ━━━ BANGALORE REGION (10) ━━━
    { id: 'b1', market: 'Bangalore APMC', distance: 12.5, modal_price: 15.5, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.9716, longitude: 77.5946 }, color: '#4CAF50', trend: 'up', arrival_date: '26/03/2026' },
    { id: 'b2', market: 'K.R. Puram Mandi', distance: 22, modal_price: 14.2, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 13.0112, longitude: 77.7058 }, color: '#4CAF50', trend: 'stable', arrival_date: '26/03/2026' },
    { id: 'b3', market: 'Malleswaram Mandi', distance: 8, modal_price: 16.0, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.9984, longitude: 77.5714 }, color: '#4CAF50', trend: 'up', arrival_date: '26/03/2026' },
    { id: 'b4', market: 'Ramanagara APMC', distance: 48, modal_price: 13.8, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.7233, longitude: 77.2764 }, color: '#4CAF50', trend: 'down', arrival_date: '26/03/2026' },
    { id: 'b5', market: 'Channapatna Mandi', distance: 60, modal_price: 14.5, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.6465, longitude: 77.1996 }, color: '#4CAF50', trend: 'up', arrival_date: '26/03/2026' },
    { id: 'b6', market: 'Magadi Mandi', distance: 52, modal_price: 14.0, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.9602, longitude: 77.2272 }, color: '#4CAF50', trend: 'stable', arrival_date: '26/03/2026' },
    { id: 'b7', market: 'Kanakapura APMC', distance: 65, modal_price: 13.2, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.5513, longitude: 77.4208 }, color: '#4CAF50', trend: 'down', arrival_date: '26/03/2026' },
    { id: 'b8', market: 'Doddaballapura Mandi', distance: 40, modal_price: 15.2, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 13.2925, longitude: 77.5336 }, color: '#4CAF50', trend: 'up', arrival_date: '26/03/2026' },
    { id: 'b9', market: 'Devanahalli APMC', distance: 35, modal_price: 15.8, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 13.2483, longitude: 77.7126 }, color: '#4CAF50', trend: 'stable', arrival_date: '26/03/2026' },
    { id: 'b10', market: 'Nelamangala Mandi', distance: 28, modal_price: 14.8, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 13.0975, longitude: 77.3934 }, color: '#4CAF50', trend: 'up', arrival_date: '26/03/2026' },

    // ━━━ MYSORE REGION (10) ━━━
    { id: 'm1', market: 'Mysore Mandi', distance: 140, modal_price: 14.5, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.2958, longitude: 76.6394 }, color: '#2196F3', trend: 'stable', arrival_date: '26/03/2026' },
    { id: 'm2', market: 'Nanjangud APMC', distance: 165, modal_price: 14.0, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.1158, longitude: 76.6800 }, color: '#2196F3', trend: 'down', arrival_date: '26/03/2026' },
    { id: 'm3', market: 'Hunsur Mandi', distance: 175, modal_price: 14.8, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.3088, longitude: 76.2908 }, color: '#2196F3', trend: 'up', arrival_date: '26/03/2026' },
    { id: 'm4', market: 'T.Narasipura Mandi', distance: 160, modal_price: 14.2, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.2106, longitude: 76.8994 }, color: '#2196F3', trend: 'stable', arrival_date: '26/03/2026' },
    { id: 'm5', market: 'K.R.Nagar APMC', distance: 155, modal_price: 14.6, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.4411, longitude: 76.3814 }, color: '#2196F3', trend: 'up', arrival_date: '26/03/2026' },
    { id: 'm6', market: 'Periyapatna Mandi', distance: 180, modal_price: 13.8, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.3411, longitude: 76.0967 }, color: '#2196F3', trend: 'down', arrival_date: '26/03/2026' },
    { id: 'm7', market: 'Gundlupet Mandi', distance: 195, modal_price: 15.2, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 11.8083, longitude: 76.6833 }, color: '#2196F3', trend: 'up', arrival_date: '26/03/2026' },
    { id: 'm8', market: 'Saragur Mandi', distance: 185, modal_price: 14.1, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.0433, longitude: 76.3811 }, color: '#2196F3', trend: 'stable', arrival_date: '26/03/2026' },
    { id: 'm9', market: 'H.D. Kote Mandi', distance: 190, modal_price: 14.3, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.0833, longitude: 76.3333 }, color: '#2196F3', trend: 'up', arrival_date: '26/03/2026' },
    { id: 'm10', market: 'Bannur Mandi', distance: 150, modal_price: 14.7, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.3333, longitude: 76.8667 }, color: '#2196F3', trend: 'stable', arrival_date: '26/03/2026' },

    // ━━━ HASSAN REGION (10) ━━━
    { id: 'h1', market: 'Hassan APMC', distance: 185, modal_price: 13.0, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 13.0033, longitude: 76.1004 }, color: '#FF9800', trend: 'down', arrival_date: '26/03/2026' },
    { id: 'h2', market: 'Arsikere APMC', distance: 160, modal_price: 12.8, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 13.3135, longitude: 76.2570 }, color: '#FF9800', trend: 'stable', arrival_date: '26/03/2026' },
    { id: 'h3', market: 'Belur Mandi', distance: 220, modal_price: 13.5, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 13.1611, longitude: 75.8601 }, color: '#FF9800', trend: 'up', arrival_date: '26/03/2026' },
    { id: 'h4', market: 'Channarayapatna APMC', distance: 145, modal_price: 13.2, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.8996, longitude: 76.3905 }, color: '#FF9800', trend: 'down', arrival_date: '26/03/2026' },
    { id: 'h5', market: 'Holenarispura Mandi', distance: 170, modal_price: 13.4, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.7820, longitude: 76.2309 }, color: '#FF9800', trend: 'stable', arrival_date: '26/03/2026' },
    { id: 'h6', market: 'Arkalgud Mandi', distance: 190, modal_price: 13.1, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.7633, longitude: 76.0617 }, color: '#FF9800', trend: 'down', arrival_date: '26/03/2026' },
    { id: 'h7', market: 'Sakleshpur Mandi', distance: 235, modal_price: 14.0, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.9431, longitude: 75.7865 }, color: '#FF9800', trend: 'up', arrival_date: '26/03/2026' },
    { id: 'h8', market: 'Alur Mandi', distance: 200, modal_price: 13.3, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.9833, longitude: 75.9833 }, color: '#FF9800', trend: 'stable', arrival_date: '26/03/2026' },
    { id: 'h9', market: 'Konanur Mandi', distance: 215, modal_price: 13.6, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 12.6333, longitude: 76.0167 }, color: '#FF9800', trend: 'up', arrival_date: '26/03/2026' },
    { id: 'h10', market: 'Javagal Mandi', distance: 165, modal_price: 12.9, commodity: 'Tomato', state: 'Karnataka', coords: { latitude: 13.3, longitude: 76.05 }, color: '#FF9800', trend: 'down', arrival_date: '26/03/2026' },
];

const CROPS = ['All', 'Tomato', 'Wheat', 'Rice', 'Onion', 'Maize', 'Potato'];

export default function SmartSellAdvisor() {
    const colorScheme = useColorScheme() ?? 'light';
    const { t } = useAuth();
    const [selectedCrop, setSelectedCrop] = useState('All');
    const [markets, setMarkets] = useState<any[]>(FALLBACK_MARKETS);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [userLoc, setUserLoc] = useState({ latitude: 12.9716, longitude: 77.5946 });
    const [sortBy, setSortBy] = useState<'price' | 'dist'>('price');
    const mapRef = useRef<MapView>(null);

    useEffect(() => {
        (async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({});
                    setUserLoc(loc.coords);
                }
            } catch (e) {
                console.warn("[Advisor] GPS Permission Error");
            }
        })();
    }, []);


    const getSortedMarkets = () => {
        return [...markets].sort((a, b) => {
            if (sortBy === 'price') return b.modal_price - a.modal_price;
            return a.distance - b.distance;
        });
    };

    const sorted = getSortedMarkets();
    const filtered = sorted.filter(m => 
        m.market.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.commodity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.district && m.district.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const bestMarket = filtered.length > 0 ? filtered[0] : null;

    const handleSell = (m: any) => {
        Alert.alert(
            "Market Engagement",
            `Choose an action for ${m.market}:`,
            [
                { text: "Call APMC Support", onPress: () => Linking.openURL(`tel:18004251555`) },
                { text: "Request Transport", onPress: () => Alert.alert("Coming Soon", "Logistics services are being integrated.") },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* ━━━ PREMIUM HEADER ━━━ */}
            <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Sell Crops</Text>
                    <TouchableOpacity style={styles.locBadge}>
                        <IconSymbol name="location.fill" size={12} color="#fff" />
                        <Text style={styles.locText}>Karnataka</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.searchRow}>
                    <View style={styles.searchBar}>
                        <IconSymbol name="magnifyingglass" size={18} color="#999" />
                        <TextInput
                            placeholder="Find Mandi..."
                            style={styles.input}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={() => {}}
                        />
                    </View>
                    <TouchableOpacity
                        style={[styles.sortBtn, sortBy === 'price' && styles.sortBtnActive]}
                        onPress={() => setSortBy(sortBy === 'price' ? 'dist' : 'price')}
                    >
                        <Text style={styles.sortBtnText}>{sortBy === 'price' ? '₹ High' : '📍 Near'}</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* ━━━ INTERACTIVE MAP ━━━ */}
            <View style={styles.mapBox}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    initialRegion={{
                        ...userLoc,
                        latitudeDelta: 0.8,
                        longitudeDelta: 0.8,
                    }}
                >
                    <Marker coordinate={userLoc} title="My Farm" pinColor="blue" />
                    {filtered.map((m) => (
                        <Marker
                            key={m.id}
                            coordinate={m.coords}
                            pinColor={m.id === bestMarket?.id ? "#FFD600" : "#F44336"}
                        >
                            <Callout>
                                <View style={styles.callout}>
                                    <Text style={styles.calloutType}>{m.market.includes('APMC') ? 'APMC Market' : 'Local Mandi'}</Text>
                                    <Text style={styles.calloutTitle}>{m.market}</Text>
                                    <Text style={styles.calloutPrice}>₹{m.modal_price.toFixed(1)}/kg</Text>
                                    <Text style={styles.calloutCrop}>{m.commodity}</Text>
                                </View>
                            </Callout>
                        </Marker>
                    ))}
                </MapView>
            </View>

            {/* ━━━ CROP STRIP ━━━ */}
            <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cropStrip}>
                    {CROPS.map((c) => (
                        <TouchableOpacity
                            key={c}
                            style={[styles.cropPill, selectedCrop === c && styles.cropPillActive]}
                            onPress={() => setSelectedCrop(c)}
                        >
                            <Text style={[styles.cropText, selectedCrop === c && styles.cropTextActive]}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* ━━━ LISTING ━━━ */}
            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 40 }}>
                {loading ? (
                    <ActivityIndicator style={{ marginTop: 40 }} color="#2E7D32" size="large" />
                ) : (
                    filtered.map((m) => (
                        <View key={m.id} style={[styles.marketCard, m.id === bestMarket?.id && styles.bestMarketCard]}>
                            {m.id === bestMarket?.id && (
                                <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>BEST PRICE</Text></View>
                            )}
                            <View style={styles.cardMain}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.marketName}>{m.market}</Text>
                                    <View style={styles.metaLine}>
                                        <Text style={styles.districtLabel}>{m.district}</Text>
                                        <Text style={styles.distance}>• {m.distance} km away</Text>
                                    </View>
                                    <View style={styles.metaLine}>
                                        <Text style={styles.arrival}>Updated: {m.arrival_date}</Text>
                                    </View>
                                    <Text style={styles.commodityLabel}>{m.commodity}</Text>
                                </View>
                                <View style={styles.priceBox}>
                                    <Text style={styles.priceUnit}>₹/kg</Text>
                                    <Text style={styles.priceValue}>{m.modal_price.toFixed(1)}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.sellBtn}
                                onPress={() => handleSell(m)}
                            >
                                <Text style={styles.sellBtnText}>SELL HERE</Text>
                                <IconSymbol name="chevron.right" size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { paddingTop: 60, paddingBottom: 25, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
    locBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5 },
    locText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    searchRow: { flexDirection: 'row', gap: 10 },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, height: 48 },
    input: { flex: 1, marginLeft: 8, fontSize: 15, color: '#333' },
    sortBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingHorizontal: 15, justifyContent: 'center', height: 48, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    sortBtnActive: { backgroundColor: '#FFD600', borderColor: '#FFD600' },
    sortBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

    mapBox: { height: 240, overflow: 'hidden', margin: 15, borderRadius: 24, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
    map: { width: '100%', height: '100%' },
    callout: { padding: 8, minWidth: 120 },
    calloutType: { fontSize: 8, color: '#666', fontWeight: 'bold', textTransform: 'uppercase' },
    calloutTitle: { fontWeight: '800', fontSize: 13, color: '#1B5E20' },
    calloutPrice: { fontSize: 18, fontWeight: '900', color: '#2E7D32', marginVertical: 0 },
    calloutCrop: { fontSize: 11, color: '#666' },

    cropStrip: { paddingHorizontal: 15, paddingVertical: 15 },
    cropPill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
    cropPillActive: { backgroundColor: '#1B5E20' },
    cropText: { fontSize: 13, fontWeight: '800', color: '#666' },
    cropTextActive: { color: '#fff' },

    list: { flex: 1, paddingHorizontal: 15 },
    marketCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 15, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, borderWidth: 1, borderColor: '#f0f0f0' },
    bestMarketCard: { borderColor: '#FFD600', borderWidth: 2, backgroundColor: '#FFFDF0' },
    bestBadge: { position: 'absolute', top: -10, right: 20, backgroundColor: '#FFD600', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
    bestBadgeText: { fontSize: 10, fontWeight: '900', color: '#000' },
    cardMain: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    marketName: { fontSize: 18, fontWeight: '900', color: '#1B5E20' },
    metaLine: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
    districtLabel: { fontSize: 13, color: '#2E7D32', fontWeight: '800', textTransform: 'capitalize' },
    distance: { fontSize: 13, color: '#666', fontWeight: '600' },
    arrival: { fontSize: 12, color: '#999' },
    commodityLabel: { fontSize: 12, color: '#2E7D32', fontWeight: '800', marginTop: 5, textTransform: 'uppercase' },
    priceBox: { alignItems: 'flex-end', backgroundColor: '#F1F8E9', padding: 12, borderRadius: 16, minWidth: 80 },
    priceUnit: { fontSize: 10, fontWeight: 'bold', color: '#2E7D32' },
    priceValue: { fontSize: 28, fontWeight: '900', color: '#1B5E20' },
    sellBtn: { backgroundColor: '#1B5E20', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, gap: 10 },
    sellBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 }
});
