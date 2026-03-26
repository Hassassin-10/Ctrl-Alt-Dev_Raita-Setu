import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { db } from '@/services/firebase';
import { getFarmAdvice, getFarmAdviceFromAudio, getFarmAdviceFromImage } from '@/services/gemini';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { collection, limit, onSnapshot, orderBy, query, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useBiometric } from '@/hooks/use-biometric';
import * as NotificationsService from '@/services/notifications';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, FlatList, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const [isRecording, setIsRecording] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const { user, role, profile, language, t, setLanguage, switchRole, notifications, unreadCount, clearNotifications } = useAuth();
  const [showNotes, setShowNotes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { isEnabled: isBioEnabled, setBiometricEnabled } = useBiometric();

  // Weather State
  const [weather, setWeather] = useState<any>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [reminderTime, setReminderTime] = useState(new Date(new Date().setHours(8, 0, 0, 0)));
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadWeather();
    const jobsQuery = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'), limit(5));
    const unsubJobs = onSnapshot(jobsQuery, (snap) => {
      setFeaturedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const sellQuery = query(collection(db, 'sellOffers'), orderBy('createdAt', 'desc'), limit(20));
    const unsubSell = onSnapshot(sellQuery, (snap) => {
      setSellOffers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubJobs(); unsubSell(); };
  }, []);

  useEffect(() => {
    const bannerTimer = setInterval(() => {
      setActiveBanner((prev) => {
        const next = (prev + 1) % BANNERS.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 2000);
    return () => clearInterval(bannerTimer);
  }, []);

  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [isPostingOffer, setIsPostingOffer] = useState(false);

  // Sell Form State
  const [sellingCrop, setSellingCrop] = useState('Tomato');
  const [sellingQty, setSellingQty] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [sellingVariety, setSellingVariety] = useState('');
  const [sellOffers, setSellOffers] = useState<any[]>([]);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [dailyInsight, setDailyInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [featuredJobs, setFeaturedJobs] = useState<any[]>([]);
  const micPulse = useRef(new Animated.Value(1)).current;
  const bannerRef = useRef<FlatList>(null);
  const [activeBanner, setActiveBanner] = useState(0);
  const [mandiSearch, setMandiSearch] = useState('');

  const MANDI_CONTACTS = [
    { id: '1', name: 'Davanagere APMC', phone: '081922-31111', type: 'Official' },
    { id: '2', name: 'Tiptur Coconut Mandi', phone: '08134-250320', type: 'Specialized' },
    { id: '3', name: 'Mysuru Fruit & Veg', phone: '0821-2521101', type: 'Official' },
    { id: '4', name: 'Hassan Coffee/Spice', phone: '1800-425-1555', type: 'State Support' },
    { id: '5', name: 'Kolar Tomato Market', phone: '08152-222046', type: 'Producer Market' },
  ];

  const BANNERS = [
    { id: '1', title: 'Organic Boost', sub: 'Eco-friendly fertilizer for your fields', img: require('@/assets/images/ad_fertilizer.png') },
    { id: '2', title: 'New Mahindra Series', sub: 'Upgrade your tractor with 0% EMI', img: require('@/assets/images/ad_tractor.png') },
    { id: '3', title: 'Karnataka Subsidies', sub: 'Register for seed distribution now', img: require('@/assets/images/ad_subsidy.png') },
  ];

  const loadWeather = async () => {
    try {
      setLoadingWeather(true);
      setWeatherError(null);

      let lat = 12.9716; // Bengaluru Defaults
      let lon = 77.5946;
      let cityFallback = "Bengaluru";

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let pos = await Location.getLastKnownPositionAsync({});
          if (!pos) {
            pos = await Promise.race([
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
            ]) as any;
          }
          if (pos) {
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
          }
        }
      } catch (e) {
        console.warn("[Weather] Location unavailable, using defaults");
      }

      const API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || 'bd43ad02211cf713fd0f72a4ed1d5765';
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
      console.log(`[Weather] Fetching: ${url}`);

      const res = await fetch(url);
      const data = await res.json();
      console.log(`[Weather] Response:`, data);

      if (data.main) {
        let suggestion = 'generalGood';
        const cond = data.weather[0].main;
        if (cond === 'Rain' || cond === 'Drizzle' || cond === 'Thunderstorm') suggestion = 'harvestAvoid';
        else if (cond === 'Clear') suggestion = 'sowingGood';

        setWeather({
          city: data.name || cityFallback,
          temp: Math.round(data.main.temp),
          condition: data.weather[0].main,
          humidity: data.main.humidity,
          wind: Math.round(data.wind.speed * 3.6),
          suggestion: suggestion
        });
        setWeatherError(null);
      } else if (data.cod == 401 || data.cod == '401') {
        // Fallback for Demo if API key is invalid
        // Try to get real city name via reverse geocoding
        let realCity = cityFallback;
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (geo && geo[0]) realCity = geo[0].city || geo[0].district || cityFallback;
        } catch (e) { }

        setWeather({
          city: realCity + " (Demo)",
          temp: 28,
          condition: "Clear",
          humidity: 45,
          wind: 12,
          suggestion: "sowingGood"
        });
        loadDailyInsight(realCity);
        setWeatherError(null);
      } else {
        setWeatherError(data.message || "API Error");
      }
    } catch (e) {
      setWeatherError("Network Error");
    } finally {
      setLoadingWeather(false);
    }
  };

  const startVoiceAssist = () => {
    setAiModalVisible(true);
    setAiResponse('');
    setAiInput('');
    setPickedImage(null);
  };

  const selectPlantImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPickedImage(result.assets[0].base64);
    }
  };

  const loadDailyInsight = async (city: string) => {
    setLoadingInsight(true);
    try {
      const prompt = `Give me one very short, high-value agricultural pro-tip for today. 
        Context: I am a ${role || 'Farmer'} in ${city}. The weather context is provided.
        Respond ONLY in ${language}.`;
      const tip = await getFarmAdvice(prompt, { role, city, language });
      setDailyInsight(tip);
    } catch (e) {
      setDailyInsight(language === 'Kannada' ? "ಇಂದಿನ ಕೃಷಿ ಸಲಹೆ: ಹವಾಮಾನವು ಬೆಳೆಗೆ ಪೂರಕವಾಗಿದೆ." : "Daily Insight: Weather is good for crops.");
    } finally {
      setLoadingInsight(false);
    }
  };

  const takePlantPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to analyze plants.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPickedImage(result.assets[0].base64);
    }
  };

  const speak = (text: string) => {
    Speech.speak(text, { language: 'kn-IN', rate: 0.85, pitch: 1.0 });
  };

  const startMicRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsVoiceRecording(true);
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } catch (e) {
      console.warn('Mic start error', e);
    }
  };

  const stopMicRecording = async () => {
    if (!recording) return;
    micPulse.stopAnimation();
    micPulse.setValue(1);
    setIsVoiceRecording(false);
    setAiThinking(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (uri) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const context = { role, city: weather?.city || 'Bengaluru' };
        const advice = await getFarmAdviceFromAudio(base64, context);
        setAiResponse(advice);
        speak(advice);
      }
    } catch (e) {
      setAiResponse("ಆಡಿಯೋ ಅರ್ಥ ಮಾಡಿಕೊಳ್ಳಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ ಕೇಳಿ.");
    } finally {
      setAiThinking(false);
    }
  };

  const handleAiRequest = async () => {
    if (!aiInput.trim()) return;
    setAiThinking(true);
    setAiResponse('');

    const context = { role, city: weather?.city || 'Bengaluru', language };

    try {
      let advice = '';
      if (pickedImage) {
        advice = await getFarmAdviceFromImage(pickedImage, aiInput, context);
      } else {
        advice = await getFarmAdvice(aiInput, context);
      }
      setAiResponse(advice);
      speak(advice);
    } catch (e) {
      setAiResponse("ಮಾಹಿತಿ ತೆಗೆದುಕೊಳ್ಳಲು ಸಮಸ್ಯೆ ಇದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.");
    } finally {
      setAiThinking(false);
    }
  };

  const toggleReminder = async (value: boolean) => {
    if (!user) return;
    try {
      if (value) {
        const granted = await NotificationsService.requestNotificationPermissions();
        if (granted) {
          await NotificationsService.scheduleDailyReminder(8, 0);
          Alert.alert('🔔 Reminder On', 'We will send you a daily farm update at 8:00 AM.');
        } else {
          Alert.alert('Permission Denied', 'Please enable notifications in settings.');
          return;
        }
      } else {
        await NotificationsService.cancelDailyReminder();
        Alert.alert('🔕 Reminder Off', 'Daily reminders disabled.');
      }
      await setDoc(doc(db, 'users', user.uid), { dailyReminder: value }, { merge: true });
    } catch (e: any) {
      Alert.alert('Update Failed', e.message);
    }
  };

  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate && user) {
      setReminderTime(selectedDate);
      if (profile?.dailyReminder) {
        await NotificationsService.scheduleDailyReminder(selectedDate.getHours(), selectedDate.getMinutes());
        Alert.alert('🔔 Time Updated', `Reminder set for ${selectedDate.getHours()}:${selectedDate.getMinutes().toString().padStart(2, '0')}`);
      }
      await setDoc(doc(db, 'users', user.uid), { reminderHour: selectedDate.getHours(), reminderMinute: selectedDate.getMinutes() }, { merge: true });
    }
  };

  const postSellOffer = async () => {
    if (!user || !sellingQty || !sellingPrice) {
      Alert.alert('Missing Info', 'Please fill quantity and expected price.');
      return;
    }
    setIsPostingOffer(true);
    try {
      await addDoc(collection(db, 'sellOffers'), {
        farmerId: user.uid,
        farmerName: profile?.fullName || 'Indian Farmer',
        farmerPhone: profile?.phone || 'N/A',
        crop: sellingCrop,
        variety: sellingVariety || 'Standard',
        quantity: sellingQty,
        askingPrice: sellingPrice,
        location: { city: weather?.city || 'Karnataka', lat: 12.9716, lng: 77.5946 },
        status: 'Open',
        createdAt: serverTimestamp(),
      });
      Alert.alert('🎉 Success', 'Your selling offer is live! Mandis will contact you soon.');
      setShowSellModal(false);
      setSellingQty('');
      setSellingPrice('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsPostingOffer(false);
    }
  };

  const shortName = profile?.fullName?.split(' ').slice(0, 2).join(' ') || null;

  return (
    <View style={styles.container}>

      {/* ━━━ FIXED GREEN HEADER (stays on top, scroll slides under) ━━━ */}
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.fixedHeader}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.brandContainer}>
              <View style={styles.logoPill}>
                <Image
                  source={require('@/assets/images/logo.png')}
                  style={{ width: 24, height: 24 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandText}>RAITHA SETU</Text>
            </View>
            <Text style={styles.greetNamaste}>🙏 {t.namaste}</Text>
            <Text style={styles.greetTag}>
              {shortName ? `${shortName}!` : `${t.farmer}!`}
            </Text>
            <Text style={styles.greetDate}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <View style={styles.weatherPill}>
              <Text style={styles.weatherPillIcon}>
                {loadingWeather ? '🌐' : weather?.condition === 'Rain' ? '🌧️' : weather?.condition === 'Clouds' ? '⛅' : '☀️'}
              </Text>
              <Text style={styles.weatherPillText}>
                {loadingWeather
                  ? 'Fetching...'
                  : weather
                    ? `${weather.temp}°C · ${weather.city}`
                    : 'Weather unavailable'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.bellBtn} onPress={() => setShowNotes(true)}>
              <IconSymbol name="bell.fill" size={20} color="#fff" />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.bellBtn} onPress={() => setShowSettings(true)}>
              <IconSymbol name="gearshape.fill" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* ━━━ SCROLLABLE CONTENT (slides behind the fixed green header) ━━━ */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >

        {/* ━━━ AI ASSISTANT CARD (just below header, overlaps the green/white edge) ━━━ */}
        {(role === 'Farmer' || role === 'MachineryOwner') && (
          <TouchableOpacity onPress={startVoiceAssist} activeOpacity={0.88} style={styles.aiCard}>
            <LinearGradient
              colors={['#7C3AED', '#4F46E5']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.aiCardGrad}
            >
              <View style={styles.aiGlow1} />
              <View style={styles.aiGlow2} />
              <View style={styles.aiCardLeft}>
                <View style={styles.aiIconRing}>
                  <Text style={{ fontSize: 28 }}>🤖</Text>
                </View>
                <View style={{ marginLeft: 14 }}>
                  <Text style={styles.aiCardTitle}>AI Farm Manager</Text>
                  <Text style={styles.aiCardSub}>Crops · Pests · Market · Weather</Text>
                </View>
              </View>
              <View style={styles.aiMicBtn}>
                <IconSymbol name="chevron.right" size={20} color="#7C3AED" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ━━━ 3. SERVICES GRID ━━━ */}
        <View style={styles.servicesBlock}>
          <Text style={styles.blockTitle}>{t.quickServices}</Text>
          <View style={styles.servicesGrid}>
            {role === 'Labour' ? (
              <>
                <ServiceTile label={t.workBoard} emoji="💼" grad={['#FF6D00', '#F4511E']} onPress={() => router.push('/(tabs)/labour')} />
                <ServiceTile label={t.wallet} emoji="💳" grad={['#00897B', '#00695C']} onPress={() => Alert.alert(t.comingSoon, t.applySoon)} />
                <ServiceTile label={t.myProfile} emoji="👤" grad={['#1E88E5', '#1565C0']} onPress={() => router.push('/(tabs)/profile')} />
                <ServiceTile label={t.schemes} emoji="📘" grad={['#8E24AA', '#6A1B9A']} onPress={() => router.push('/(tabs)/schemes')} />
              </>
            ) : role === 'MachineryOwner' ? (
              <>
                <ServiceTile label={t.myMachinery} emoji="🚜" grad={['#1E88E5', '#1565C0']} onPress={() => router.push('/machinery-rental')} />
                <ServiceTile label={t.earnings} emoji="💰" grad={['#43A047', '#2E7D32']} onPress={() => Alert.alert(t.earnings, 'Payouts arriving soon!')} />
                <ServiceTile label={t.bookLabour} emoji="👷" grad={['#FF8F00', '#E65100']} onPress={() => router.push('/(tabs)/labour')} />
                <ServiceTile label={t.settings} emoji="⚙️" grad={['#546E7A', '#37474F']} onPress={() => router.push('/(tabs)/profile')} />
              </>
            ) : (
              <>
                <ServiceTile label={t.hireLabour} emoji="👷" grad={['#FF6D00', '#E65100']} onPress={() => router.push('/(tabs)/labour')} />
                <ServiceTile label={t.machinery} emoji="🚜" grad={['#1E88E5', '#1565C0']} onPress={() => router.push('/machinery-market')} />
                <ServiceTile label={t.cropAdvisor} emoji="🌿" grad={['#00897B', '#00695C']} onPress={() => router.push('/(tabs)/track')} />
                <ServiceTile label={t.schemes} emoji="📘" grad={['#8E24AA', '#6A1B9A']} onPress={() => router.push('/(tabs)/schemes')} />
              </>
            )}
          </View>
        </View>

        {/* ━━━ 3.5 COMMUNITY SECTION ━━━ */}
        <View style={styles.communityContainer}>
          <View style={styles.communityHeader}>
            <Text style={styles.communityTitleText}>{t.askCommunity}</Text>
            <TouchableOpacity onPress={() => router.push('/community')}>
              <Text style={styles.viewAllText}>See What's New →</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.communityCard}
            onPress={() => router.push('/community')}
            activeOpacity={0.9}
          >
            <View style={styles.communityCardHeader}>
              <View style={styles.trendingBadge}>
                <IconSymbol name="sparkles" size={12} color="#00C853" />
                <Text style={styles.trendingText}>Trending in Karnataka</Text>
              </View>
              <View style={styles.avatarGroup}>
                {['👨‍🌾', '👩‍🌾', '🚜'].map((emoji, i) => (
                  <View key={i} style={[styles.miniAvatar, { marginLeft: i === 0 ? 0 : -12, zIndex: 10 - i }]}>
                    <Text style={{ fontSize: 10 }}>{emoji}</Text>
                  </View>
                ))}
                <View style={[styles.miniAvatar, styles.membersCount, { marginLeft: -12 }]}>
                  <Text style={styles.membersText}>+5k</Text>
                </View>
              </View>
            </View>

            <Text style={styles.communityQuestion}>"Best way to protect Tomato crops from late blight in current rain?"</Text>

            <View style={styles.communityCardFooter}>
              <View style={styles.engagementStats}>
                <View style={styles.statItem}>
                  <IconSymbol name="bubble.left.fill" size={14} color="#666" />
                  <Text style={styles.statText}>124 Answers</Text>
                </View>
                <View style={[styles.statItem, { marginLeft: 12 }]}>
                  <IconSymbol name="heart.fill" size={14} color="#666" />
                  <Text style={styles.statText}>892</Text>
                </View>
              </View>
              <View style={styles.joinAction}>
                <Text style={styles.joinActionText}>Join Discussion</Text>
                <IconSymbol name="chevron.right" size={12} color="#2E7D32" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ━━━ BANNER CAROUSEL (Moved below Community) ━━━ */}
        <View style={styles.bannerContainer}>
          <FlatList
            ref={bannerRef}
            data={BANNERS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / (width - 36));
              if (slide !== activeBanner) setActiveBanner(slide);
            }}
            getItemLayout={(_, index) => (
              { length: width - 36, offset: (width - 36) * index, index }
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.95}
                style={styles.bannerWrapper}
                onPress={() => item.id === '3' ? router.push('/(tabs)/schemes') : setShowSellModal(true)}
              >
                <Image
                  source={item.img}
                  style={styles.bannerImg}
                  onError={() => console.log('Image failed')}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.bannerOverlay}
                >
                  <Text style={styles.bannerTitle}>{item.title}</Text>
                  <Text style={styles.bannerSubText}>{item.sub}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            keyExtractor={item => item.id}
          />
          <View style={styles.pagination}>
            {BANNERS.map((_, i) => (
              <View key={i} style={[styles.dot, activeBanner === i && styles.activeDot]} />
            ))}
          </View>
        </View>

        {/* ━━━ 4. HARVEST TRACKER ━━━ */}
        {(role === 'Farmer' || role === 'MachineryOwner') && (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.infoCardEmoji}>🌾</Text>
              <Text style={styles.infoCardTitle}>{t.harvestReady || t.cropProgress}</Text>
            </View>
            <View style={styles.progressRow}>
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, { backgroundColor: '#1565C0' }]}>
                  <Text style={{ fontSize: 14 }}>🏠</Text>
                </View>
                <Text style={styles.stepLabel}>{t.sown}</Text>
              </View>
              <View style={[styles.progressConnector, { backgroundColor: '#1565C0' }]} />
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, { backgroundColor: '#FF8F00' }]}>
                  <Text style={{ fontSize: 14 }}>🌿</Text>
                </View>
                <Text style={styles.stepLabel}>{t.growth}</Text>
              </View>
              <View style={styles.progressConnector} />
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, { backgroundColor: '#E0E0E0' }]}>
                  <Text style={{ fontSize: 14 }}>🛒</Text>
                </View>
                <Text style={[styles.stepLabel, { color: '#aaa' }]}>{t.harvest}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ━━━ 5. DAILY TIP ━━━ */}
        {(role === 'Farmer' || role === 'MachineryOwner') && (
          <View style={styles.tipCard}>
            <LinearGradient colors={['#E8F5E9', '#F1F8E9']} style={styles.tipCardGrad}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={styles.tipIconBg}>
                  <Text style={{ fontSize: 18 }}>💡</Text>
                </View>
                <Text style={styles.tipTitle}>{t.todayFarmTip}</Text>
                {!loadingInsight && (
                  <TouchableOpacity onPress={() => loadDailyInsight(weather?.city || 'Bengaluru')} style={styles.refreshBtn}>
                    <Text style={{ fontSize: 16 }}>🔄</Text>
                  </TouchableOpacity>
                )}
              </View>
              {loadingInsight
                ? <ActivityIndicator color="#2E7D32" />
                : <Text style={styles.tipText}>
                  {dailyInsight || t.farmingAdviceLoading}
                </Text>
              }
            </LinearGradient>
          </View>
        )}

        {/* ━━━ 7. MANDI CONTACT DIRECTORY ━━━ */}
        <View style={styles.mandiDirectory}>
          <View style={styles.mandiHeader}>
            <View>
              <Text style={styles.mandiTitle}>📞 APMC Contact List</Text>
              <Text style={styles.mandiSub}>Search and contact local market support</Text>
            </View>
            <IconSymbol name="phone.circle.fill" size={32} color="#1B5E20" />
          </View>

          <View style={styles.mandiSearchRow}>
            <TextInput
              placeholder="Search Mandi Name..."
              style={styles.mandiInput}
              value={mandiSearch}
              onChangeText={setMandiSearch}
              placeholderTextColor="#999"
            />
          </View>

          <ScrollView
            style={styles.mandiList}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {MANDI_CONTACTS.filter(m => m.name.toLowerCase().includes(mandiSearch.toLowerCase())).map((m) => (
              <View key={m.id} style={styles.mandiCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mandiCardName}>{m.name}</Text>
                  <Text style={styles.mandiCardType}>{m.type}</Text>
                </View>
                <TouchableOpacity
                  style={styles.callMandiBtn}
                  onPress={() => Linking.openURL(`tel:${m.phone}`)}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="phone.fill" size={14} color="#fff" />
                  <Text style={styles.callMandiText}>Call</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ━━━ 6. LABOUR JOB BOARD ━━━ */}
        {role === 'Labour' && (
          <View>
            <TouchableOpacity style={styles.jobPortalBanner} onPress={() => router.push('/(tabs)/labour')}>
              <LinearGradient colors={['#FF6D00', '#BF360C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.jobPortalGrad}>
                <Text style={styles.jobPortalTitle}>🔍  Daily Jobs Portal</Text>
                <Text style={styles.jobPortalSub}>Find verified agricultural work near you</Text>
                <View style={styles.jobPortalArrow}>
                  <IconSymbol name="chevron.right" size={16} color="#FF6D00" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              {featuredJobs.length > 0 ? (
                featuredJobs.map(job => (
                  <JobCard
                    key={job.id}
                    title={job.workType}
                    price={`₹${job.wage}/Day`}
                    dist={job.location?.name || 'Nearby'}
                    type={job.status === 'Open' ? 'New' : 'Active'}
                  />
                ))
              ) : (
                <View style={{ width: width - 40, alignItems: 'center', padding: 24, backgroundColor: '#FFF8F6', borderRadius: 16, borderWidth: 1, borderColor: '#FFE0B2' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                  <Text style={{ color: '#BF360C', fontWeight: '600', textAlign: 'center' }}>No open jobs nearby. Check back soon!</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        <NotificationModal
          visible={showNotes}
          onClose={() => setShowNotes(false)}
          notifications={notifications}
          clear={clearNotifications}
        />

        <QuickSettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          profile={profile}
          language={language}
          setLanguage={setLanguage}
          isBioEnabled={isBioEnabled}
          setBiometricEnabled={setBiometricEnabled}
          toggleReminder={toggleReminder}
          currentRole={role}
          switchRole={switchRole}
          reminderTime={reminderTime}
          setShowTimePicker={setShowTimePicker}
        />

        {showTimePicker && (
          <DateTimePicker
            value={reminderTime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}

        {/* AI Modal */}
        <Modal visible={aiModalVisible} animationType="slide" transparent={true}>
          <View style={styles.aiModalContainer}>
            <View style={[styles.aiModalSheet, { backgroundColor: '#fff' }]}>
              <View style={styles.aiModalHeader}>
                <View style={styles.aiLabel}>
                  <IconSymbol name="sparkles" size={16} color={c.primary} />
                  <Text style={styles.aiLabelText}>{t.appName} {t.aiAssistant}</Text>
                </View>
                <TouchableOpacity onPress={() => { setAiModalVisible(false); Speech.stop(); }}>
                  <IconSymbol name="xmark.circle.fill" size={28} color="#999" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.aiScroll} showsVerticalScrollIndicator={false}>
                {isVoiceRecording && (
                  <View style={styles.thinkingContainer}>
                    <Animated.View style={[styles.micPulseRing, { transform: [{ scale: micPulse }] }]} />
                    <Text style={{ fontSize: 48 }}>🎤</Text>
                    <Text style={[styles.thinkingText, { color: '#ff3b30', fontWeight: 'bold' }]}>🔴 {t.recording}</Text>
                    <Text style={{ color: '#888', fontSize: 13, marginTop: 4, textAlign: 'center' }}>{t.askQuestionHint}</Text>
                  </View>
                )}
                {aiThinking && !isVoiceRecording && (
                  <View style={styles.thinkingContainer}>
                    <ActivityIndicator size="large" color={c.primary} />
                    <Text style={styles.thinkingText}>{t.findingAnswer}</Text>
                  </View>
                )}
                {!aiThinking && !isVoiceRecording && aiResponse ? (
                  <View style={styles.responseContainer}>
                    <Text style={styles.responseBubble}>{aiResponse}</Text>
                    <TouchableOpacity style={styles.replayBtn} onPress={() => speak(aiResponse)}>
                      <Text style={{ fontSize: 16 }}>🔊</Text>
                      <Text style={styles.replayText}>{t.listenAgain}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {pickedImage && (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: `data:image/jpeg;base64,${pickedImage}` }} style={styles.pickedImage} />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => setPickedImage(null)}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✕ Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!aiThinking && !isVoiceRecording && !aiResponse && !pickedImage && (
                  <View style={{ alignItems: 'center', paddingTop: 30, opacity: 0.6 }}>
                    <Text style={{ fontSize: 48 }}>🌾</Text>
                    <Text style={{ fontSize: 15, color: '#666', marginTop: 10, textAlign: 'center', lineHeight: 22 }}>
                      {t.askQuestionHint}
                    </Text>
                  </View>
                )}
              </ScrollView>
              <View style={styles.aiInputArea}>
                <View style={styles.aiActionsRow}>
                  <TouchableOpacity onPress={takePlantPhoto} style={styles.extraBtn}>
                    <Text style={{ fontSize: 20 }}>📷</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={selectPlantImage} style={styles.extraBtn}>
                    <Text style={{ fontSize: 20 }}>🖼️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={isVoiceRecording ? stopMicRecording : startMicRecording}
                    style={[styles.micBtn, isVoiceRecording && { backgroundColor: '#ff3b30' }]}
                    disabled={aiThinking}
                  >
                    <Text style={{ fontSize: 22 }}>{isVoiceRecording ? '✋' : '🎤'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.aiSearchBar}>
                  <TextInput
                    style={styles.aiInput}
                    placeholder={t.typeQuestionPlaceholder}
                    value={aiInput}
                    onChangeText={setAiInput}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.aiSendBtn, { backgroundColor: c.primary }, !aiInput.trim() && { opacity: 0.5 }]}
                    onPress={handleAiRequest}
                    disabled={!aiInput.trim() || aiThinking || isVoiceRecording}
                  >
                    <IconSymbol name="paperplane.fill" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>

      <TouchableOpacity
        style={styles.whatsappFloat}
        onPress={() => Linking.openURL('https://wa.me/919380596236')}
        activeOpacity={0.8}
      >
        <IconSymbol name="whatsapp.fill" size={32} color="#25D366" />
      </TouchableOpacity>
      <SellCropModal
        visible={showSellModal}
        onClose={() => setShowSellModal(false)}
        postOffer={postSellOffer}
        crop={sellingCrop}
        setCrop={setSellingCrop}
        qty={sellingQty}
        setQty={setSellingQty}
        price={sellingPrice}
        setPrice={setSellingPrice}
        variety={sellingVariety}
        setVariety={setSellingVariety}
        loading={isPostingOffer}
      />

    </View>
  );
}

function NotificationModal({ visible, onClose, notifications, clear }: any) {

  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];

  const handleClose = () => {
    clear();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <BlurView intensity={90} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <TouchableOpacity onPress={handleClose}>
              <IconSymbol name="xmark.circle.fill" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <Text style={styles.emptyText}>No notifications yet.</Text>
            ) : (
              notifications.map((n: any) => (
                <View key={n.id} style={[styles.noteCard, !n.read && { borderLeftColor: c.cta, borderLeftWidth: 4 }]}>
                  <View style={styles.noteIconRow}>
                    <Text style={{ fontSize: 20 }}>
                      {n.type === 'job_match' ? '🎉' :
                        n.type === 'worker_joined' ? '🤝' :
                          n.type === 'booking_accepted' ? '✅' :
                            n.type === 'new_booking_request' ? '🚜' : '👤'}
                    </Text>
                    <Text style={styles.noteTime}>{new Date(n.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noteCardTitle}>{n.title}</Text>
                    <Text style={styles.noteCardMsg}>{n.message}</Text>

                    {(n.type === 'worker_joined' && n.workerPhone) && (
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                          style={styles.callActionButton}
                          onPress={() => Linking.openURL(`tel:${n.workerPhone}`)}
                        >
                          <IconSymbol name="phone.fill" size={16} color="#fff" />
                          <Text style={styles.callActionText}>Call</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.callActionButton, { backgroundColor: '#25D366' }]}
                          onPress={() => Linking.openURL(`https://wa.me/91${n.workerPhone.replace(/\D/g, '')}?text=Hi, from Raitha Setu!`)}
                        >
                          <Text style={{ fontSize: 16 }}>💬</Text>
                          <Text style={styles.callActionText}>WhatsApp</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {n.type === 'booking_accepted' && n.ownerPhone && (
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                          style={[styles.callActionButton, { backgroundColor: '#1976D2' }]}
                          onPress={() => Linking.openURL(`tel:${n.ownerPhone}`)}
                        >
                          <IconSymbol name="phone.fill" size={16} color="#fff" />
                          <Text style={styles.callActionText}>Call Owner</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.callActionButton, { backgroundColor: '#25D366' }]}
                          onPress={() => Linking.openURL(`https://wa.me/91${n.ownerPhone.replace(/\D/g, '')}?text=I am interested in your tractor rental!`)}
                        >
                          <Text style={{ fontSize: 16 }}>💬</Text>
                          <Text style={styles.callActionText}>WhatsApp</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </BlurView>
      </Pressable>
    </Modal>
  );
}

function ActionCard({ title, icon, color, onPress }: { title: string, icon: any, color: string, onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: color }]} onPress={onPress}>
      <IconSymbol name={icon} size={40} color="#fff" />
      <Text style={styles.cardTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

function ServiceTile({ label, emoji, grad, onPress }: { label: string, emoji: string, grad: string[], onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={styles.serviceTile}>
      <LinearGradient colors={grad as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.serviceTileGrad}>
        <Text style={styles.serviceTileEmoji}>{emoji}</Text>
        <Text style={styles.serviceTileLabel}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function JobCard({ title, price, dist, type }: { title: string, price: string, dist: string, type: string }) {
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.jobCard} onPress={() => router.push('/(tabs)/labour')}>
      <View style={styles.jobBadge}><Text style={styles.jobBadgeText}>{type}</Text></View>
      <Text style={styles.jobTitle}>{title}</Text>
      <View style={styles.jobRow}><IconSymbol name="location.fill" size={14} color="#666" /><Text style={styles.jobMeta}>{dist} away</Text></View>
      <Text style={styles.jobPrice}>{price}</Text>
      <View style={styles.applyBtn}><Text style={styles.applyBtnText}>View Details</Text></View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContent: { paddingTop: 285, paddingBottom: 100 },
  scrollView: { flex: 1 },

  // ── FIXED GREEN HEADER ──
  fixedHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 60, paddingBottom: 32, paddingHorizontal: 24,
    zIndex: 20, elevation: 14,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    shadowColor: '#1A5C1A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

  brandContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  logoPill: { width: 32, height: 32, backgroundColor: '#fff', borderRadius: 8, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  brandText: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 1.8, textTransform: 'uppercase' },

  greetNamaste: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  greetTag: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginTop: -2 },
  greetDate: { fontSize: 14, color: 'rgba(255,255,255,0.78)', marginTop: 5, fontWeight: '500' },

  weatherPill: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', gap: 6 },
  weatherPillIcon: { fontSize: 16 },
  weatherPillText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  bellBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF3D00', borderRadius: 10, paddingHorizontal: 5, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // ── MANDI DIRECTORY ──
  mandiDirectory: { marginHorizontal: 18, marginBottom: 20, backgroundColor: '#fff', borderRadius: 24, padding: 20, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  mandiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  mandiTitle: { fontSize: 19, fontWeight: '900', color: '#1B5E20' },
  mandiSub: { fontSize: 12, color: '#666', marginTop: 2, fontWeight: '500' },
  mandiSearchRow: { marginBottom: 15 },
  mandiInput: { backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 15, height: 44, color: '#333', fontSize: 14, borderWidth: 1, borderColor: '#eee' },
  mandiList: { maxHeight: 200 },
  mandiCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  mandiCardName: { fontSize: 15, fontWeight: '800', color: '#333' },
  mandiCardType: { fontSize: 11, fontWeight: 'bold', color: '#2E7D32', textTransform: 'uppercase', marginTop: 2 },
  callMandiBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1B5E20', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 6 },
  callMandiText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // ── BANNER SLIDER ──
  bannerContainer: { marginHorizontal: 18, marginBottom: 25, borderRadius: 24, overflow: 'hidden', height: 180, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, backgroundColor: '#fff' },
  bannerWrapper: { width: width - 36, height: 180 },
  bannerImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  bannerOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingTop: 40 },
  bannerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  bannerSubText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '600' },
  pagination: { position: 'absolute', bottom: 15, right: 20, flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  activeDot: { width: 18, backgroundColor: '#fff' },

  // kept for backwards compat (used by ActionCard if it's still rendered)
  noteBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  noteBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF3D00', borderRadius: 10, paddingHorizontal: 5, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  noteBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // ── AI CARD ──
  aiCard: { marginHorizontal: 18, marginBottom: 20, borderRadius: 24, overflow: 'hidden', elevation: 8, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
  aiCardGrad: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 24, overflow: 'hidden' },
  aiGlow1: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.07)', top: -30, right: -20 },
  aiGlow2: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, left: 80 },
  aiCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  aiIconRing: { width: 58, height: 58, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  aiCardTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  aiCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  aiMicBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },

  // kept for backwards compat
  aiBanner: { marginHorizontal: 18, marginBottom: 20, borderRadius: 24, overflow: 'hidden', elevation: 6 },
  aiBannerInner: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 24 },
  aiLogoBox: { width: 58, height: 58, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  aiBannerTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  aiBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  aiBannerMic: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

  // ── SERVICES ──
  servicesBlock: { paddingHorizontal: 18, marginBottom: 20 },
  blockTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 14 },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  serviceTile: { width: (width - 48) / 2, borderRadius: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 6 },
  serviceTileGrad: { paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 110 },
  serviceTileEmoji: { fontSize: 34, marginBottom: 8 },
  serviceTileLabel: { fontSize: 14, fontWeight: '800', color: '#fff', textAlign: 'center' },

  // kept for ActionCard backwards compat
  servicesSection: { paddingHorizontal: 18, marginBottom: 20 },
  sectionLabel: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 14 },
  communityContainer: { paddingHorizontal: 20, marginBottom: 25 },
  communityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  communityTitleText: { fontSize: 18, fontWeight: '900', color: '#1A1A2E' },
  viewAllText: { fontSize: 12, fontWeight: 'bold', color: '#2E7D32' },
  communityCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  communityCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  trendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  trendingText: { fontSize: 11, fontWeight: 'bold', color: '#2E7D32' },
  avatarGroup: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0f0f0', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  membersCount: { backgroundColor: '#00C853' },
  membersText: { fontSize: 9, fontWeight: 'bold', color: '#fff' },
  communityQuestion: { fontSize: 16, fontWeight: '700', color: '#333', lineHeight: 24, marginBottom: 15 },
  communityCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f9f9f9', paddingTop: 15 },
  engagementStats: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 12, color: '#666', fontWeight: '500' },
  joinAction: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  joinActionText: { fontSize: 12, fontWeight: 'bold', color: '#2E7D32' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  card: { width: (width - 48) / 2, aspectRatio: 1.05, borderRadius: 22, justifyContent: 'center', alignItems: 'center', padding: 16, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6 },
  cardTitle: { marginTop: 10, fontSize: 14, fontWeight: '700', color: '#fff', textAlign: 'center' },

  // ── INFO CARD (harvest tracker) ──
  infoCard: { marginHorizontal: 18, marginBottom: 16, backgroundColor: '#fff', borderRadius: 22, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  infoCardEmoji: { fontSize: 22, marginRight: 10 },
  infoCardTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressStep: { alignItems: 'center' },
  progressDot: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  progressConnector: { flex: 1, height: 3, backgroundColor: '#E0E0E0', marginHorizontal: 6 },
  stepLabel: { fontSize: 11, fontWeight: '700', marginTop: 6, color: '#555' },

  // kept for backwards compat
  progressLine: { flex: 1, height: 3, backgroundColor: '#E0E0E0', marginHorizontal: 8, marginTop: -14 },
  stepText: { fontSize: 11, fontWeight: '700', marginTop: 5, color: '#555' },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00C853', marginTop: 5 },
  insightText: { fontSize: 14, color: '#333', lineHeight: 21, fontWeight: '500' },

  // kept for whiteCard backwards compat
  whiteCard: { marginHorizontal: 18, marginBottom: 16, backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  whiteCardLabel: { fontSize: 13, fontWeight: '800', color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },

  // ── TIP CARD ──
  tipCard: { marginHorizontal: 18, marginBottom: 16, borderRadius: 22, overflow: 'hidden', elevation: 2 },
  tipCardGrad: { padding: 20, borderRadius: 22 },
  tipIconBg: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(46,125,50,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  tipTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#1B5E20' },
  refreshBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(46,125,50,0.1)', justifyContent: 'center', alignItems: 'center' },
  tipText: { fontSize: 14, color: '#2E7D32', lineHeight: 22, fontWeight: '500' },

  // ── SELLING SECTION ──
  sellSection: { paddingHorizontal: 20, marginBottom: 25 },
  sellHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sellTitle: { fontSize: 18, fontWeight: '900', color: '#1A1A2E' },
  sellActionBtn: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#00C853' },
  sellActionText: { color: '#2E7D32', fontWeight: 'bold', fontSize: 13 },
  sellList: { paddingRight: 20 },
  offerCard: { backgroundColor: '#fff', borderRadius: 22, padding: 16, width: 220, marginRight: 15, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, borderWidth: 1, borderColor: '#f0f0f0' },
  offerBadge: { backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 },
  offerBadgeText: { fontSize: 9, color: '#E65100', fontWeight: 'bold' },
  offerCrop: { fontSize: 18, fontWeight: '800', color: '#111' },
  offerVariety: { fontSize: 12, color: '#666', marginTop: 2 },
  offerStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, borderTopWidth: 1, borderTopColor: '#f9f9f9', paddingTop: 12 },
  statLabSm: { fontSize: 10, color: '#999', fontWeight: 'bold', textTransform: 'uppercase' },
  statValSm: { fontSize: 14, fontWeight: '900', color: '#1B5E20', marginTop: 2 },
  offerBtn: { backgroundColor: '#f5f5f5', paddingVertical: 10, borderRadius: 12, marginTop: 15, alignItems: 'center' },
  offerBtnText: { fontSize: 12, fontWeight: 'bold', color: '#555' },
  emptySell: { padding: 40, alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 24, borderStyle: 'solid', borderWidth: 1, borderColor: '#ddd' },
  emptySellText: { fontSize: 14, color: '#999', fontWeight: '600' },

  sellModalSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 25 },
  sellInput: { backgroundColor: '#f5f5f5', borderRadius: 16, padding: 15, fontSize: 16, color: '#333', marginBottom: 15, fontWeight: '600' },
  sellBtn: { backgroundColor: '#1B5E20', paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginTop: 10 },
  sellBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },

  // ── JOB PORTAL ──
  jobPortalBanner: { marginHorizontal: 18, marginBottom: 14, borderRadius: 20, overflow: 'hidden', elevation: 5 },
  jobPortalGrad: { padding: 20, borderRadius: 20 },
  jobPortalTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  jobPortalSub: { fontSize: 13, color: 'rgba(255,255,255,0.80)', marginTop: 4 },
  jobPortalArrow: { position: 'absolute', right: 16, top: '50%', width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.82, backgroundColor: '#fff', padding: 24, paddingTop: 60, borderTopRightRadius: 32, borderBottomRightRadius: 32, elevation: 25, shadowColor: '#000', shadowOffset: { width: 10, height: 0 }, shadowOpacity: 0.3, shadowRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 40, fontSize: 16 },
  noteCard: { backgroundColor: 'rgba(255,255,255,0.5)', padding: 15, borderRadius: 15, marginBottom: 12 },
  noteIconRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  noteTime: { fontSize: 11, color: '#888' },
  noteCardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  noteCardMsg: { fontSize: 14, color: '#444', marginTop: 4 },
  callActionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00C853', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginTop: 10, alignSelf: 'flex-start' },
  callActionText: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
  weatherContainer: { paddingHorizontal: 20, marginTop: 10, marginBottom: 20 },
  weatherCard: { padding: 20, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  weatherLoading: { height: 100, justifyContent: 'center', alignItems: 'center' },
  weatherMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weatherCity: { fontSize: 13, color: '#444', fontWeight: 'bold' },
  weatherTemp: { fontSize: 38, fontWeight: '900', color: '#111', marginTop: 5 },
  weatherCond: { fontSize: 16, color: '#333', fontWeight: '500' },
  weatherDetails: { flexDirection: 'row', gap: 20, marginTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)', paddingTop: 15 },
  weatherItem: {},
  weatherLabel: { fontSize: 10, color: '#666', opacity: 0.8 },
  weatherVal: { fontSize: 14, fontWeight: 'bold', color: '#111' },
  weatherTip: { marginTop: 15, backgroundColor: 'rgba(255,255,255,0.9)', padding: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherTipText: { fontSize: 13, fontWeight: 'bold', color: '#1B5E20' },
  aiModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  aiModalSheet: { width: '100%', height: '70%', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  aiModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  aiLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  aiLabelText: { fontSize: 14, fontWeight: 'bold', color: '#2E7D32' },
  aiScroll: { flex: 1 },
  thinkingContainer: { alignItems: 'center', marginTop: 40 },
  thinkingText: { marginTop: 15, fontSize: 16, color: '#666', fontStyle: 'italic' },
  responseContainer: { padding: 5 },
  responseBubble: { backgroundColor: '#f0f0f0', padding: 20, borderRadius: 20, fontSize: 17, color: '#333', lineHeight: 24, borderBottomLeftRadius: 5 },
  replayBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#00C853', alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, marginTop: 15 },
  replayText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  aiInputArea: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
  aiActionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 15 },
  aiSearchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 28, paddingHorizontal: 15, paddingVertical: 6, minHeight: 56 },
  aiInput: { flex: 1, paddingHorizontal: 10, maxHeight: 100, fontSize: 16, color: '#333' },
  aiSendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  micBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#00C853' },
  micPulseRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,59,48,0.2)' },
  extraBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  imagePreviewContainer: { marginVertical: 15, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 15, alignItems: 'center' },
  pickedImage: { width: width - 80, height: 200, borderRadius: 12 },
  removeImageBtn: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  hubBanner: { paddingHorizontal: 20, marginBottom: 20 },
  hubGradient: { padding: 20, borderRadius: 25, flexDirection: 'row', alignItems: 'center', gap: 15, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
  hubIconBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  hubTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  hubSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  jobSection: { marginBottom: 25 },
  jobCard: { width: 160, backgroundColor: '#fff', padding: 15, borderRadius: 20, marginRight: 15, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  jobBadge: { backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 10 },
  jobBadgeText: { fontSize: 10, color: '#E65100', fontWeight: 'bold' },
  jobTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  jobMeta: { fontSize: 12, color: '#666' },
  jobPrice: { fontSize: 18, fontWeight: '900', color: '#E65100', marginTop: 10 },
  applyBtn: { backgroundColor: '#FFE0B2', paddingVertical: 6, borderRadius: 10, marginTop: 15, alignItems: 'center' },
  applyBtnText: { color: '#E65100', fontWeight: 'bold', fontSize: 12 },
  whatsappFloat: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 999,
  },

  // Settings Modal Specifics
  settingsItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  settingsIcon: { fontSize: 22, marginRight: 14 },
  settingsLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
  roleGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 15, backgroundColor: '#f5f5f5', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  roleActive: { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' },
  roleEmoji: { fontSize: 20, marginBottom: 4 },
  roleText: { fontSize: 11, fontWeight: '800', color: '#666' },
  roleTextActive: { color: '#1B5E20' },
  langGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  langBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f0f0f0' },
  langBtnActive: { backgroundColor: '#2E7D32' },
  langText: { fontSize: 13, fontWeight: '700', color: '#555' },
  langTextActive: { color: '#fff' },
  settingsSection: { marginBottom: 25, backgroundColor: '#f9f9f9', padding: 16, borderRadius: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
});

function QuickSettingsModal({ visible, onClose, profile, language, setLanguage, isBioEnabled, setBiometricEnabled, toggleReminder, currentRole, switchRole, reminderTime, setShowTimePicker }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet}>
          <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 20, marginBottom: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={onClose} style={{ backgroundColor: '#f5f5f5', padding: 8, borderRadius: 12 }}>
                <IconSymbol name="chevron.left" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { fontSize: 22, fontWeight: '900' }]}>Side Menu</Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={[styles.settingsSection, { backgroundColor: '#fdfdfd', borderWidth: 1, borderColor: '#eee', padding: 18 }]}>
                <Text style={styles.sectionTitle}>🌍 Language Preference</Text>
                <View style={[styles.langGrid, { marginBottom: 25 }]}>
                  {['English', 'Hindi', 'Kannada'].map(l => (
                    <TouchableOpacity
                      key={l}
                      style={[styles.langBtn, language === l && styles.langBtnActive, { flex: 1, alignItems: 'center' }]}
                      onPress={() => setLanguage(l)}
                    >
                      <Text style={[styles.langText, language === l && styles.langTextActive]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ height: 1, backgroundColor: '#eee', marginBottom: 20 }} />

                <Text style={styles.sectionTitle}>🔒 Security & Alerts</Text>
                <View style={styles.settingsItem}>
                  <Text style={styles.settingsIcon}>👆</Text>
                  <Text style={styles.settingsLabel}>Biometric Login</Text>
                  <Switch value={isBioEnabled} onValueChange={setBiometricEnabled} trackColor={{ false: '#ddd', true: '#00C853' }} />
                </View>
                <View style={[styles.settingsItem, { borderBottomWidth: 0, marginBottom: 5 }]}>
                  <Text style={styles.settingsIcon}>🔔</Text>
                  <Text style={styles.settingsLabel}>Daily App Reminder</Text>
                  <Switch value={profile?.dailyReminder} onValueChange={toggleReminder} trackColor={{ false: '#ddd', true: '#FF6D00' }} />
                </View>
                {profile?.dailyReminder && (
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    style={{ marginLeft: 36, padding: 8, backgroundColor: '#FFF3E0', borderRadius: 8, alignSelf: 'flex-start', marginBottom: 10 }}
                  >
                    <Text style={{ fontSize: 13, color: '#E65100', fontWeight: 'bold' }}>
                      Set Time: {reminderTime.getHours()}:{reminderTime.getMinutes().toString().padStart(2, '0')} 🕒
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={{ height: 1, backgroundColor: '#eee', marginBottom: 20 }} />

                <Text style={styles.sectionTitle}>👤 Active Persona</Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 15, marginTop: -8 }}>Switch roles to access different features.</Text>
                <View style={styles.roleGrid}>
                  {[
                    { id: 'Farmer', emoji: '🚜', label: 'Farmer', color: '#1B5E20' },
                    { id: 'Labour', emoji: '👷', label: 'Labour', color: '#E65100' },
                    { id: 'MachineryOwner', emoji: '⚙️', label: 'Owner', color: '#0D47A1' }
                  ].map(r => (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.roleBtn, currentRole === r.id && { borderColor: r.color, backgroundColor: '#fff' }]}
                      onPress={() => { switchRole(r.id); onClose(); }}
                    >
                      <Text style={styles.roleEmoji}>{r.emoji}</Text>
                      <Text style={[styles.roleText, currentRole === r.id && { color: r.color, fontWeight: '900' }]}>{r.label}</Text>
                      {currentRole === r.id && (
                        <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: r.color, width: 14, height: 14, borderRadius: 7 }}>
                          <IconSymbol name="checkmark" size={10} color="#fff" style={{ textAlign: 'center' }} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={{ marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: '#f5f5f5', alignItems: 'center' }}
            onPress={onClose}
          >
            <Text style={{ fontWeight: '800', color: '#666' }}>CLOSE MENU</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SellCropModal({ visible, onClose, postOffer, crop, setCrop, qty, setQty, price, setPrice, variety, setVariety, loading }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.sellModalSheet} onStartShouldSetResponder={() => true}>
          <View style={[styles.modalHeader, { marginBottom: 20 }]}>
            <Text style={[styles.modalTitle, { fontSize: 24, fontWeight: '900' }]}>🌾 Sell Your Yield</Text>
            <TouchableOpacity onPress={onClose}>
              <IconSymbol name="xmark.circle.fill" size={28} color="#ccc" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Crop Variety</Text>
          <TextInput
            style={styles.sellInput}
            placeholder="e.g. Sona Masuri, Hybrid"
            value={variety}
            onChangeText={setVariety}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Quantity (Qtl)</Text>
              <TextInput
                style={styles.sellInput}
                placeholder="0"
                keyboardType="numeric"
                value={qty}
                onChangeText={setQty}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Exp. Price (₹)</Text>
              <TextInput
                style={styles.sellInput}
                placeholder="2000"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.sellBtn} onPress={postOffer} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sellBtnText}>POST SELLING OFFER</Text>}
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}
