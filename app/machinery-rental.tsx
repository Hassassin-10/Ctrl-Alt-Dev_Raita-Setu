import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { db } from '@/services/firebase';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function MachineryRentalHub() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, role, t } = useAuth();

  const [loading, setLoading] = useState(true);
  const [machinery, setMachinery] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<any>(null);

  const [viewMode, setViewMode] = useState<'hub' | 'action' | 'requests'>(role === 'Farmer' ? 'hub' : 'action');
  const [activeCategory, setActiveCategory] = useState('All');
  const [receivedBookings, setReceivedBookings] = useState<any[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<any>(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);

  // New Listing State
  const [newMachine, setNewMachine] = useState({ name: '', price: '', type: 'Tractor', description: '', phone: profile?.phone || '', ownerName: user?.displayName || '', image: null as string | null });
  const [uploading, setUploading] = useState(false);

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
          if (!loc) {
            loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          }
          if (loc) {
            setUserLocation(loc.coords);
          }
        }
      } catch (e) {
        console.warn("Machinery location error:", e);
      } finally {
        setLoading(false);
      }
    })();

    const q = collection(db, 'machinery');
    const unsubMachinery = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a: any, b: any) => {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      setMachinery(items);
    });

    let unsubBookings = () => { };
    if (user) {
      const qB = query(collection(db, 'bookings'), where('ownerId', '==', user.uid));
      unsubBookings = onSnapshot(qB, (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setReceivedBookings(items.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
      });
    }

    return () => {
      unsubMachinery();
      unsubBookings();
    };
  }, [user]);

  const calculateDistance = (targetLoc: any) => {
    if (!userLocation || !targetLoc) return '...';
    const R = 6371; // km
    const dLat = (targetLoc.lat - userLocation.latitude) * Math.PI / 180;
    const dLon = (targetLoc.lng - userLocation.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(userLocation.latitude * Math.PI / 180) * Math.cos(targetLoc.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const cVal = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * cVal).toFixed(1);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.1, // compress heavily for Firestore
      base64: true
    });
    if (!result.canceled && result.assets[0].base64) {
      setNewMachine(prev => ({
        ...prev,
        image: `data:image/jpeg;base64,${result.assets[0].base64}`
      }));
    }
  };

  const handlePostListing = async () => {
    if (!newMachine.name || !newMachine.price || !user) return;
    setUploading(true);
    try {
      // Bulletproof: Save directly to Firestore (Bypass broken Storage SDK)
      await addDoc(collection(db, 'machinery'), {
        ownerId: user.uid,
        name: newMachine.name,
        price: newMachine.price,
        type: newMachine.type,
        phone: newMachine.phone,
        ownerName: newMachine.ownerName,
        description: newMachine.description,
        image: newMachine.image, // Base64 Data URL
        location: { lat: userLocation?.latitude || 12.97, lng: userLocation?.longitude || 77.59 },
        rating: 4.8,
        createdAt: new Date().toISOString()
      });
      setViewMode('hub');
      setNewMachine({ name: '', price: '', type: 'Tractor', description: '', phone: profile?.phone || '', ownerName: user?.displayName || '', image: null });
      Alert.alert("Success", "Machine is now available for rent!");
    } catch (e: any) {
      console.error("Post Error:", e.message);
      Alert.alert("Upload Error", "Could not save listing. Database connection error.");
    }
    finally { setUploading(false); }
  };

  const handleDeleteListing = (id: string) => {
    Alert.alert("Delete Listing", "Are you sure you want to remove this machine?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteDoc(doc(db, 'machinery', id));
            Alert.alert("Success", "Listing removed from marketplace.");
          } catch (e: any) {
            Alert.alert("Error", "Could not delete listing.");
          }
        }
      }
    ]);
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
      setSelectedMachine(null);
      setBookingModalVisible(false);
      Alert.alert("Success", "Request sent! The owner will contact you shortly.");
    } catch (e: any) { Alert.alert("Booking Failed", e.message); }
    finally { setBookingLoading(false); }
  };

  const handleAcceptBooking = async (booking: any) => {
    try {
      await updateDoc(doc(db, 'bookings', booking.id), { status: 'Accepted' });

      // Notify the farmer
      await addDoc(collection(db, 'notifications'), {
        userId: booking.farmerId,
        title: 'Booking Accepted! ✅',
        message: `Your booking for ${booking.machineName} has been accepted. Tap to call owner.`,
        type: 'booking_accepted',
        ownerPhone: profile?.phone || 'No phone provided',
        read: false,
        createdAt: new Date().toISOString()
      });

      Alert.alert("Success", "Booking accepted! The farmer has been notified.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const filteredMachines = machinery.filter(m => {
    // If owner view, show only their gear
    if (viewMode === 'hub') return m.ownerId === user?.uid;

    const matchedCategory = activeCategory === 'All' || m.type === activeCategory;
    const matchedSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchedCategory && matchedSearch;
  });

  const renderMachineCard = ({ item }: { item: any }) => {
    const dist = calculateDistance(item.location);
    const isOwner = user?.uid === item.ownerId;

    return (
      <TouchableOpacity
        style={styles.premiumCard}
        onPress={() => {
          if (!isOwner) {
            setSelectedMachine(item);
            setBookingModalVisible(true);
          }
        }}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.cardId}>RS-{item.id.slice(0, 4).toUpperCase()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: '#E8F5E9' }]}>
            <Text style={{ fontSize: 12, color: '#2E7D32', fontWeight: 'bold' }}>
              Verified
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 15, marginBottom: 15 }}>
          <Image source={{ uri: item.image || 'https://via.placeholder.com/300' }} style={styles.machineThumbnail} />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={styles.premiumName}>{item.name}</Text>
            <Text style={styles.machineTypeBadge}>{item.type}</Text>
          </View>
        </View>

        <View style={styles.contentRow}>
          <Text style={{ fontSize: 18, marginRight: 8 }}>💰</Text>
          <Text style={styles.contentText}>₹{item.price} per hour</Text>
        </View>

        <View style={styles.locationWrapper}>
          <View style={styles.locationItem}>
            <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.locationText}>{dist} km away</Text>
          </View>
          <View style={styles.locationItem}>
            <View style={[styles.dot, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.locationText}>Location Verified</Text>
          </View>
        </View>

        <View style={styles.cardSeparator} />

        <View style={styles.cardBottom}>
          <View style={styles.dateInfo}>
            <Text style={{ fontSize: 14 }}>⭐</Text>
            <Text style={styles.dateText}>{item.rating || '4.8'} Rating</Text>
          </View>

          {isOwner ? (
            <TouchableOpacity
              style={[styles.callActionButton, { borderColor: '#f44336' }]}
              onPress={() => handleDeleteListing(item.id)}
            >
              <IconSymbol name="trash.fill" size={16} color="#f44336" />
              <Text style={[styles.callNumberText, { color: '#f44336' }]}>Remove</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.callActionButton}>
              <Text style={styles.callNumberText}>Book Now</Text>
              <IconSymbol name="chevron.right" size={14} color="#111" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRequestCard = ({ item }: { item: any }) => (
    <View style={styles.requestItemCard}>
      <View style={styles.requestHeader}>
        <View>
          <Text style={styles.requestFarmer}>{item.farmerName || 'Farmer'}</Text>
          <Text style={styles.requestDate}>{item.date} • {item.duration}h</Text>
        </View>
        <View style={[styles.statusBadge, item.status === 'Accepted' && { backgroundColor: '#E8F5E9' }]}>
          <Text style={[styles.statusText, item.status === 'Accepted' && { color: '#2E7D32' }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.requestMachine}>Machine: {item.machineName}</Text>
      <View style={styles.requestFooter}>
        <Text style={styles.requestPrice}>Total: ₹{item.totalPrice}</Text>
        {item.status === 'Pending' && (
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => handleAcceptBooking(item)}
          >
            <IconSymbol name="checkmark.circle.fill" size={16} color="#fff" />
            <Text style={styles.acceptBtnText}>Accept</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <LinearGradient colors={['#00C853', '#1B5E20']} style={styles.headerGradient}>
        <View style={styles.topNav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <IconSymbol name="chevron.left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitleText}>Machinery Rentals</Text>
          <TouchableOpacity onPress={() => Share.share({ message: 'Book machinery on Raitha Setu!' })} style={styles.iconBtn}>
            <IconSymbol name="square.and.arrow.up" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          {/* removed Market tab as per user request */}

          {role === 'MachineryOwner' && (
            <>
              <TouchableOpacity
                style={[styles.tab, viewMode === 'hub' && styles.activeTab]}
                onPress={() => setViewMode('hub')}
              >
                <Text style={[styles.tabText, viewMode === 'hub' && styles.activeTabText]}>My Gear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, viewMode === 'action' && styles.activeTab]}
                onPress={() => setViewMode('action')}
              >
                <Text style={[styles.tabText, viewMode === 'action' && styles.activeTabText]}>List</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, viewMode === 'requests' && styles.activeTab]}
                onPress={() => setViewMode('requests')}
              >
                <Text style={[styles.tabText, viewMode === 'requests' && styles.activeTabText]}>Orders</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {viewMode === 'hub' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterBtn, activeCategory === cat && styles.filterBtnActive]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.filterText, activeCategory === cat && { color: c.primary }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </LinearGradient>

      {viewMode === 'hub' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchContainer}>
            <View style={styles.searchBarContainer}>
              <IconSymbol name="magnifyingglass" size={20} color="#888" />
              <TextInput
                style={styles.searchTextInput}
                placeholder="Search for tractors, harvesters..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          <FlatList
            data={filteredMachines}
            renderItem={renderMachineCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainerContent}>
                <Text style={styles.emptyTitleText}>No machinery found</Text>
                <Text style={styles.emptySubText}>Try a different category or search term.</Text>
              </View>
            }
          />
        </View>
      ) : viewMode === 'action' ? (
        <ScrollView contentContainerStyle={styles.formContent}>
          <Text style={styles.formLabel}>Category</Text>
          <View style={styles.categoryGrid}>
            {categories.filter(c => c !== 'All').map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.smallChip, newMachine.type === cat && { backgroundColor: c.primary, borderColor: c.primary }]}
                onPress={() => setNewMachine(p => ({ ...p, type: cat }))}
              >
                <Text style={{ color: newMachine.type === cat ? '#fff' : '#666', fontWeight: 'bold' }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Machine Image</Text>
          <TouchableOpacity onPress={handlePickImage} style={styles.imageSelector}>
            {newMachine.image ? (
              <Image source={{ uri: newMachine.image }} style={styles.imagePreview} />
            ) : (
              <View style={{ alignItems: 'center' }}>
                <IconSymbol name="camera.fill" size={40} color="#ccc" />
                <Text style={{ color: '#999', marginTop: 10 }}>Tap to upload</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.formLabel}>Machine Name</Text>
          <TextInput
            placeholder="e.g. John Deere Tractor"
            style={styles.formInput}
            value={newMachine.name}
            onChangeText={t => setNewMachine(p => ({ ...p, name: t }))}
          />

          <Text style={styles.formLabel}>Hourly Rate (₹)</Text>
          <TextInput
            placeholder="Rate per hour"
            style={styles.formInput}
            keyboardType="numeric"
            value={newMachine.price}
            onChangeText={t => setNewMachine(p => ({ ...p, price: t }))}
          />

          <Text style={styles.formLabel}>Full Details / Description</Text>
          <TextInput
            placeholder="e.g. Model year, hours used, fuel type..."
            style={[styles.formInput, { height: 100, textAlignVertical: 'top' }]}
            multiline
            value={newMachine.description}
            onChangeText={t => setNewMachine(p => ({ ...p, description: t }))}
          />

          <Text style={styles.formLabel}>Owner Name</Text>
          <TextInput
            placeholder="Your name"
            style={styles.formInput}
            value={newMachine.ownerName}
            onChangeText={t => setNewMachine(p => ({ ...p, ownerName: t }))}
          />

          <Text style={styles.formLabel}>Owner Contact (Mobile)</Text>
          <TextInput
            placeholder="Your phone number"
            style={styles.formInput}
            keyboardType="phone-pad"
            value={newMachine.phone}
            onChangeText={t => setNewMachine(p => ({ ...p, phone: t }))}
          />

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: c.primary }]}
            onPress={handlePostListing}
            disabled={uploading}
          >
            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>List Machinery</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={receivedBookings}
          renderItem={renderRequestCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainerContent}>
              <Text style={styles.emptyTitleText}>No orders yet</Text>
              <Text style={styles.emptySubText}>Machine requests will appear here.</Text>
            </View>
          }
        />
      )}

      {/* Booking Modal (Farmer booking a machine) */}
      <Modal visible={bookingModalVisible} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setBookingModalVisible(false)}>
          <BlurView intensity={100} tint="light" style={styles.modalSheet}>
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Confirm Booking</Text>
              <TouchableOpacity onPress={() => setBookingModalVisible(false)}><IconSymbol name="xmark.circle.fill" size={28} color="#999" /></TouchableOpacity>
            </View>
            {selectedMachine && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.brief}>
                  <Image source={{ uri: selectedMachine.image }} style={styles.briefImg} />
                  <View>
                    <Text style={styles.briefName}>{selectedMachine.name}</Text>
                    <Text style={styles.briefMeta}>₹{selectedMachine.price} / hour</Text>
                  </View>
                </View>
                <Text style={styles.label}>Requested Date</Text>
                <TextInput style={styles.input} value={bookingDate} onChangeText={setBookingDate} placeholder="YYYY-MM-DD" />
                <Text style={styles.label}>Duration (Hours)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={duration} onChangeText={setDuration} />

                <View style={styles.costBox}>
                  <View style={styles.costRow}><Text style={styles.costLab}>Machine Rate</Text><Text style={styles.costVal}>₹{selectedMachine.price}/h</Text></View>
                  <View style={styles.costRow}><Text style={[styles.costLab, { fontWeight: 'bold' }]}>Grand Total</Text><Text style={[styles.costVal, { color: '#00C853', fontSize: 18 }]}>₹{parseInt(selectedMachine.price || '0') * parseInt(duration || '0')}</Text></View>
                </View>

                <TouchableOpacity style={styles.mainBtn} onPress={handleConfirmBooking} disabled={bookingLoading}>
                  {bookingLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>Book Now</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </BlurView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { padding: 20, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  iconBtn: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitleText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 15, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  activeTab: { backgroundColor: '#fff' },
  tabText: { color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' },
  activeTabText: { color: '#00C853' },
  categoryScroll: { marginTop: 15 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  filterBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  filterText: { fontSize: 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' },
  searchContainer: { padding: 20, paddingBottom: 10 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 15, paddingHorizontal: 15, height: 50 },
  searchTextInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  listContainer: { padding: 20 },
  premiumCard: { backgroundColor: '#fff', borderRadius: 25, padding: 25, marginBottom: 20, borderWidth: 1, borderColor: '#f0f0f0', elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardId: { color: '#888', letterSpacing: 1, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20 },
  machineThumbnail: { width: 80, height: 80, borderRadius: 15 },
  premiumName: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  machineTypeBadge: { color: '#00C853', fontWeight: 'bold', marginTop: 4 },
  contentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 5 },
  contentText: { fontSize: 18, color: '#444', fontWeight: 'bold' },
  locationWrapper: { gap: 10, marginBottom: 20 },
  locationItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  locationText: { color: '#666', fontSize: 16 },
  cardSeparator: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 20 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { color: '#888', fontSize: 15 },
  callActionButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f9f9f9', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: '#eee' },
  callNumberText: { fontSize: 14, fontWeight: 'bold', color: '#111' },
  formContent: { padding: 25 },
  formLabel: { fontSize: 15, fontWeight: 'bold', color: '#444', marginTop: 20, marginBottom: 8 },
  imageSelector: { width: '100%', height: 180, backgroundColor: '#f5f5f5', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: '#eee', borderStyle: 'dotted' },
  imagePreview: { width: '100%', height: '100%', borderRadius: 18 },
  formInput: { backgroundColor: '#f9f9f9', padding: 16, borderRadius: 15, fontSize: 16, borderWidth: 1, borderColor: '#eee', marginBottom: 10 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  smallChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  submitBtn: { marginTop: 40, padding: 18, borderRadius: 15, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  requestItemCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  requestFarmer: { fontSize: 18, fontWeight: 'bold' },
  requestDate: { fontSize: 13, color: '#666' },
  requestMachine: { fontSize: 15, color: '#444', marginBottom: 15 },
  requestFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f5f5f5', paddingTop: 15 },
  requestPrice: { fontSize: 17, fontWeight: 'bold' },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2E7D32', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  acceptBtnText: { color: '#fff', fontWeight: 'bold' },
  emptyContainerContent: { alignItems: 'center', marginTop: 100 },
  emptyTitleText: { fontSize: 20, fontWeight: 'bold', color: '#ccc' },
  emptySubText: { color: '#999', marginTop: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { padding: 30, borderTopLeftRadius: 35, borderTopRightRadius: 35, backgroundColor: '#fff', minHeight: '60%' },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  brief: { flexDirection: 'row', gap: 15, backgroundColor: '#f5f5f5', padding: 15, borderRadius: 20, marginBottom: 20, alignItems: 'center' },
  briefImg: { width: 60, height: 60, borderRadius: 12 },
  briefName: { fontSize: 18, fontWeight: 'bold' },
  briefMeta: { color: '#00C853', fontWeight: 'bold' },
  label: { fontSize: 13, color: '#666', marginBottom: 8, fontWeight: 'bold', marginLeft: 5 },
  input: { backgroundColor: '#f9f9f9', padding: 16, borderRadius: 15, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#eee' },
  costBox: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 15, marginBottom: 20 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  costLab: { color: '#666' },
  costVal: { fontWeight: '900' },
  mainBtn: { backgroundColor: '#2E7D32', padding: 18, borderRadius: 15, alignItems: 'center' },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  statusText: { fontSize: 12, fontWeight: 'bold', color: '#E65100' },
});
