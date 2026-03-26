import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { db } from '@/services/firebase';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { addDoc, collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function MachineryMarket() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, t } = useAuth();

  const [loading, setLoading] = useState(true);
  const [machinery, setMachinery] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedMachine, setSelectedMachine] = useState<any>(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);

  // Booking State
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('4');
  const [bookingLoading, setBookingLoading] = useState(false);

  const categories = ['All', 'Tractors', 'Harvesters', 'Drones', 'Tools', 'Irrigation'];

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let loc = await Location.getLastKnownPositionAsync({});
          if (!loc) loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc) setUserLocation(loc.coords);
        }
      } catch (e) {
        console.warn("Location error:", e);
      } finally {
        setLoading(false);
      }
    })();

    const q = collection(db, 'machinery');
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMachinery(items.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    });
    return () => unsub();
  }, []);

  const calculateDistance = (targetLoc: any) => {
    if (!userLocation || !targetLoc) return '...';
    const R = 6371; // km
    const dLat = (targetLoc.lat - userLocation.latitude) * Math.PI / 180;
    const dLon = (targetLoc.lng - userLocation.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(userLocation.latitude * Math.PI / 180) * Math.cos(targetLoc.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  };

  const handleConfirmBooking = async () => {
    if (!user || !selectedMachine) return;
    setBookingLoading(true);
    try {
      const total = parseInt(selectedMachine.price) * parseInt(duration);
      await addDoc(collection(db, 'bookings'), {
        machineId: selectedMachine.id, machineName: selectedMachine.name,
        ownerId: selectedMachine.ownerId, farmerId: user.uid,
        farmerName: user.displayName || 'Farmer',
        date: bookingDate, duration, totalPrice: total, status: 'Pending',
        createdAt: new Date().toISOString()
      });
      await addDoc(collection(db, 'notifications'), {
        userId: selectedMachine.ownerId,
        title: 'New Rental Request! 🚜',
        message: `${user.displayName || 'A farmer'} wants to rent ${selectedMachine.name} for ${duration}h.`,
        type: 'new_booking_request',
        read: false, createdAt: new Date().toISOString()
      });
      setBookingModalVisible(false);
      Alert.alert("Success", "Request sent! The owner will contact you shortly.");
    } catch (e: any) { Alert.alert("Booking Failed", e.message); }
    finally { setBookingLoading(false); }
  };

  const handleCallOwner = (phone: string) => {
    if (!phone) {
      Alert.alert("Contact Not Available", "The owner did not provide a phone number.");
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const filtered = machinery.filter(m => {
    const matchedCategory = activeCategory === 'All' || m.type === activeCategory;
    const matchedSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchedCategory && matchedSearch;
  });

  const getIcon = (t: string) => {
    if (t === 'Drones') return 'airplane';
    if (t === 'Tractors') return 'gearshape.fill';
    return 'wrench.and.screwdriver.fill';
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <LinearGradient colors={['#00C853', '#1B5E20']} style={styles.header}>
        <View style={styles.topNav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><IconSymbol name="chevron.left" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Machinery Marketplace</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
          {categories.map(cat => (
            <TouchableOpacity key={cat} style={[styles.filterBtn, activeCategory === cat && styles.filterBtnActive]} onPress={() => setActiveCategory(cat)}>
              <Text style={[styles.filterText, activeCategory === cat && { color: '#00C853' }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      <View style={styles.searchBox}>
        <IconSymbol name="magnifyingglass" size={20} color="#888" />
        <TextInput placeholder="Search for gear..." style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      <FlatList
        data={filtered}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => { setSelectedMachine(item); setBookingModalVisible(true); }}>
            <Image source={{ uri: item.image || 'https://via.placeholder.com/300' }} style={styles.cardImg} />
            <View style={styles.cardInfo}>
              <View style={styles.badge}><IconSymbol name={getIcon(item.type)} size={12} color="#00C853" /><Text style={styles.badgeText}>{item.type}</Text></View>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardOwner}>by {item.ownerName}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardPrice}>₹{item.price}/h</Text>
                <View style={{ gap: 5, alignItems: 'flex-end' }}>
                  <View style={styles.callBadge}><Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>View Details</Text></View>
                  <View style={[styles.callBadge, { backgroundColor: '#FFA000' }]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Book Now</Text></View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>No machinery found in this category.</Text>}
      />

      <Modal visible={bookingModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setBookingModalVisible(false)} />
          <BlurView intensity={100} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Machine Details</Text>
              <TouchableOpacity onPress={() => setBookingModalVisible(false)}><IconSymbol name="xmark.circle.fill" size={28} color="#999" /></TouchableOpacity>
            </View>

            {selectedMachine && (
              <>
                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 40 }}
                >
                  <Image source={{ uri: selectedMachine.image }} style={styles.detailHero} />
                  <View style={styles.detailMain}>
                    <View style={styles.badge}><Text style={styles.badgeText}>{selectedMachine.type}</Text></View>
                    <Text style={styles.detailName}>{selectedMachine.name}</Text>
                    <Text style={styles.detailPrice}>₹{selectedMachine.price} <Text style={{ fontSize: 16, fontWeight: 'normal' }}>/ hour</Text></Text>

                    {selectedMachine.description && (
                      <View style={{ marginTop: 15, backgroundColor: '#f5f5f5', padding: 15, borderRadius: 12 }}>
                        <Text style={{ fontSize: 13, color: '#666', marginBottom: 5, fontWeight: 'bold' }}>FULL DETAILS</Text>
                        <Text style={{ fontSize: 15, color: '#444', lineHeight: 22 }}>{selectedMachine.description}</Text>
                      </View>
                    )}

                    <View style={styles.detailSeparator} />

                    <View style={styles.infoRow}>
                      <View style={styles.infoIcon}><IconSymbol name="person.fill" size={20} color="#00C853" /></View>
                      <View>
                        <Text style={styles.infoLabel}>Owner Name</Text>
                        <Text style={styles.infoVal}>{selectedMachine.ownerName}</Text>
                      </View>
                    </View>

                    <View style={styles.infoRow}>
                      <View style={styles.infoIcon}><IconSymbol name="location.fill" size={20} color="#00C853" /></View>
                      <View>
                        <Text style={styles.infoLabel}>Location</Text>
                        <Text style={styles.infoVal}>{calculateDistance(selectedMachine.location)} km away</Text>
                      </View>
                    </View>

                    <View style={styles.infoRow}>
                      <View style={styles.infoIcon}><Text style={{ fontSize: 18 }}>⭐</Text></View>
                      <View>
                        <Text style={styles.infoLabel}>Verified</Text>
                        <Text style={styles.infoVal}>Top Rated Owner</Text>
                      </View>
                    </View>

                    <View style={styles.detailSeparator} />

                    <Text style={[styles.infoLabel, { marginBottom: 15, color: '#1B5E20', fontWeight: 'bold' }]}>SCHEDULE BOOKING</Text>

                    <View style={{ gap: 15 }}>
                      <View>
                        <Text style={styles.label}>Rental Date</Text>
                        <TextInput
                          style={styles.input}
                          value={bookingDate}
                          onChangeText={setBookingDate}
                          placeholder="YYYY-MM-DD"
                        />
                      </View>
                      <View>
                        <Text style={styles.label}>Duration (Hours)</Text>
                        <TextInput
                          style={styles.input}
                          value={duration}
                          onChangeText={setDuration}
                          keyboardType="numeric"
                          placeholder="Number of hours"
                        />
                      </View>

                      <View style={styles.costBox}>
                        <View style={styles.costRow}>
                          <Text style={{ color: '#666' }}>Total Amount</Text>
                          <Text style={styles.costVal}>₹{parseInt(selectedMachine.price) * (parseInt(duration) || 0)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 20 }]}>
                  <TouchableOpacity
                    style={[styles.mainBtn, { backgroundColor: '#FFA000', marginBottom: 10 }]}
                    onPress={handleConfirmBooking}
                    disabled={bookingLoading}
                  >
                    <IconSymbol name="plus" size={20} color="#fff" />
                    <Text style={styles.mainBtnText}>{bookingLoading ? 'Processing...' : 'Confirm Book Now'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.mainBtn, { backgroundColor: '#1B5E20' }]}
                    onPress={() => handleCallOwner(selectedMachine.phone)}
                  >
                    <IconSymbol name="phone.fill" size={20} color="#fff" />
                    <Text style={styles.mainBtnText}>Call Owner Now</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  iconBtn: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  categories: { marginTop: 20 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  filterBtnActive: { backgroundColor: '#fff' },
  filterText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', margin: 20, paddingHorizontal: 15, borderRadius: 15, height: 50 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 20, flexDirection: 'row', padding: 15, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  cardImg: { width: 100, height: 100, borderRadius: 12 },
  cardInfo: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, color: '#00C853', fontWeight: 'bold', marginLeft: 4 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#111', marginTop: 5 },
  cardOwner: { fontSize: 12, color: '#666' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' },
  cardPrice: { fontSize: 20, fontWeight: '900', color: '#00C853' },
  callBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00C853', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  cardDist: { fontSize: 12, color: '#888' },
  detailHero: { width: '100%', height: 220, borderRadius: 25, marginBottom: 20 },
  detailMain: { paddingHorizontal: 5 },
  detailName: { fontSize: 26, fontWeight: 'bold', color: '#111', marginTop: 10 },
  detailPrice: { fontSize: 28, fontWeight: '900', color: '#00C853', marginTop: 8 },
  detailSeparator: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 15 },
  infoIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f0f9f1', justifyContent: 'center', alignItems: 'center' },
  infoLabel: { fontSize: 13, color: '#888' },
  infoVal: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  empty: { textAlign: 'center', color: '#999', marginTop: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { paddingHorizontal: 25, paddingTop: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#fff', height: '90%' },
  modalFooter: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  brief: { flexDirection: 'row', gap: 15, backgroundColor: '#f9f9f9', padding: 15, borderRadius: 15, marginBottom: 20 },
  briefImg: { width: 60, height: 60, borderRadius: 10 },
  briefName: { fontSize: 16, fontWeight: 'bold' },
  briefMeta: { color: '#00C853', fontWeight: 'bold' },
  label: { fontSize: 12, color: '#666', marginBottom: 5, fontWeight: 'bold' },
  input: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 12, marginBottom: 15 },
  costBox: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 12, marginBottom: 20 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between' },
  costVal: { fontWeight: 'bold', color: '#00C853', fontSize: 18 },
  mainBtn: { backgroundColor: '#00C853', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});
