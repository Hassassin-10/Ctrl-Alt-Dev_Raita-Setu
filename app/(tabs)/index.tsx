import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Animated, Dimensions, Image, Modal, Pressable, Linking, ActivityIndicator, TextInput, Alert } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRef, useState, useEffect } from 'react';
import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import * as Location from 'expo-location';
import { getFarmAdvice, getFarmAdviceFromAudio, getFarmAdviceFromImage } from '@/services/gemini';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const [isRecording, setIsRecording] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const { role, language, t, notifications, unreadCount, clearNotifications } = useAuth();
  const [showNotes, setShowNotes] = useState(false);

  // Weather State
  const [weather, setWeather] = useState<any>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);

  useEffect(() => {
    loadWeather();
  }, []);

  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [dailyInsight, setDailyInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const micPulse = useRef(new Animated.Value(1)).current;

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
           const pos = await Promise.race([
               Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
               new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
           ]) as any;
           lat = pos.coords.latitude;
           lon = pos.coords.longitude;
        }
      } catch (e) {
        console.warn("[Weather] Using default coordinates");
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
        } catch (e) {}

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

  return (
    <View style={styles.container}>
      <LinearGradient colors={[c.primary, c.accent]} style={StyleSheet.absoluteFillObject} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <Text style={styles.greeting}>{t.appName}</Text>
                    <Text style={styles.subGreeting}>{t.aiSub}</Text>
                </View>
                <TouchableOpacity style={styles.noteBtn} onPress={() => setShowNotes(true)}>
                    <IconSymbol name="bell.fill" size={24} color="#fff" />
                    {unreadCount > 0 && <View style={styles.noteBadge}><Text style={styles.noteBadgeText}>{unreadCount}</Text></View>}
                </TouchableOpacity>
            </View>
        </View>



        <View style={styles.voiceSection}>
            <Animated.View style={[styles.glowRing, { transform: [{ scale: pulseAnim }], opacity: isRecording ? 0.3 : 0 }]} />
            <TouchableOpacity onPress={startVoiceAssist} activeOpacity={0.8} style={styles.micButtonContainer}>
              <BlurView intensity={80} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={styles.micBlur}>
                  <Image 
                    source={require('../../assets/images/logo.png')} 
                    style={{ width: 60, height: 60, borderRadius: 12 }} 
                  />
              </BlurView>
            </TouchableOpacity>
            <Text style={styles.micText}>{isRecording ? t.listening || "Listening..." : t.aiManager}</Text>
        </View>

        <View style={styles.trackerContainer}>
            <BlurView intensity={50} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={styles.glassCard}>
                <Text style={styles.sectionTitle}>{t.harvestReady}</Text>
                <View style={styles.progressRow}>
                   <View style={styles.progressStep}><IconSymbol name="house.fill" size={24} color={c.primary} /><Text style={styles.stepText}>Sown</Text></View>
                   <View style={[styles.progressLine, { backgroundColor: c.primary }]} />
                   <View style={styles.progressStep}><IconSymbol name="leaf.fill" size={24} color={c.cta} /><Text style={styles.stepText}>Growth</Text></View>
                   <View style={styles.progressLine} />
                   <View style={styles.progressStep}><IconSymbol name="cart.fill" size={24} color="#999" /><Text style={styles.stepText}>Harvest</Text></View>
                </View>
            </BlurView>
        </View>

        <View style={styles.actionGrid}>
            {role === 'Farmer' || !role ? (
              <>
                <ActionCard title={t.bookMachinery} icon="cart.fill" color={c.primary} onPress={() => router.push('/(tabs)/market')} />
                <ActionCard title={t.findLabor} icon="person.fill" color={c.accent} onPress={() => router.push('/(tabs)/labour')} />
                <ActionCard title={t.track} icon="chart.bar.fill" color={c.secondary} onPress={() => router.push('/(tabs)/track')} />
                <ActionCard title={t.schemes} icon="book.fill" color={c.cta} onPress={() => router.push('/(tabs)/schemes')} />
              </>
            ) : role === 'Labour' ? (
              <>
                <ActionCard title="Available Jobs" icon="briefcase.fill" color={c.accent} onPress={() => router.push('/(tabs)/labour')} />
                <ActionCard title="My Earnings" icon="creditcard.fill" color={c.cta} onPress={() => {}} />
                <ActionCard title="Skill Training" icon="person.badge.shield.checkmark.fill" color={c.primary} onPress={() => {}} />
                <ActionCard title="Daily Attendance" icon="calendar.badge.checkmark" color={c.secondary} onPress={() => {}} />
              </>
            ) : (
              <>
                <ActionCard title="My Machinery" icon="gearshape.2.fill" color={c.secondary} onPress={() => {}} />
                <ActionCard title="Pending Bookings" icon="bell.fill" color={c.cta} onPress={() => {}} />
                <ActionCard title="Service History" icon="clock.fill" color={c.primary} onPress={() => {}} />
                <ActionCard title="Financials" icon="dollarsign.circle.fill" color={c.accent} onPress={() => {}} />
              </>
            )}
        </View>

        <View style={styles.aiInsightsContainer}>
            <Text style={styles.insightTitle}>🤖 {t.aiManager} {t.insights || 'Insights'}</Text>
            <View style={[styles.insightCard, { backgroundColor: '#E8F5E9' }]}>
                {loadingInsight ? (
                    <ActivityIndicator size="small" color="#2E7D32" style={{ marginRight: 15 }} />
                ) : (
                    <View style={styles.insightDot} />
                )}
                <View style={{ flex: 1 }}>
                    {loadingInsight ? (
                        <Text style={[styles.insightText, { color: '#666' }]}>ನಿಮಗಾಗಿ ಸಲಹೆ ಸಿದ್ದಪಡಿಸುತ್ತಿದ್ದೇವೆ...</Text>
                    ) : (
                        <Text style={styles.insightText}>{dailyInsight || t.insightDefault || "ಇಂದಿನ ಕೃಷಿ ಸಲಹೆ ಸದ್ಯದಲ್ಲೇ ಬರಲಿದೆ..."}</Text>
                    )}
                    <TouchableOpacity style={styles.insightAction} onPress={() => loadDailyInsight(weather?.city || 'Bengaluru')}>
                        <Text style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: 13 }}>{loadingInsight ? '🔄 Loading...' : '🔄 Refresh Tip'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>

        {/* Live Weather Card */}
        <View style={styles.weatherContainer}>
           <BlurView intensity={60} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={styles.weatherCard}>
             {loadingWeather ? (
               <View style={styles.weatherLoading}>
                  <Text style={{ color: '#fff' }}>Searching for your location...</Text>
               </View>
             ) : weatherError ? (
               <View style={styles.weatherLoading}>
                  <Text style={{ color: '#fff', textAlign: 'center' }}>Weather Unavailable: {weatherError}</Text>
                  <TouchableOpacity onPress={loadWeather} style={{ marginTop: 10, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15 }}>
                     <Text style={{ color: '#fff', fontWeight: 'bold' }}>Try Again</Text>
                  </TouchableOpacity>
               </View>
             ) : (
               <>
                 <View style={styles.weatherMain}>
                    <View>
                      <Text style={styles.weatherCity}>📍 {weather?.city}</Text>
                      <Text style={styles.weatherTemp}>{weather?.temp}°C</Text>
                      <Text style={styles.weatherCond}>{weather?.condition}</Text>
                    </View>
                    <IconSymbol 
                      name={
                        weather?.condition === 'Rain' ? 'cloud.rain.fill' : 
                        weather?.condition === 'Clouds' ? 'cloud.fill' : 
                        'sun.max.fill'
                      } 
                      size={60} 
                      color={weather?.condition === 'Clear' ? "#FFD700" : "#fff"} 
                    />
                 </View>
                 <View style={styles.weatherDetails}>
                    <View style={styles.weatherItem}><Text style={styles.weatherLabel}>{t.humidity}</Text><Text style={styles.weatherVal}>{weather?.humidity}%</Text></View>
                    <View style={styles.weatherItem}><Text style={styles.weatherLabel}>{t.wind}</Text><Text style={styles.weatherVal}>{weather?.wind} km/h</Text></View>
                 </View>
                 <View style={styles.weatherTip}>
                    <IconSymbol name="sparkles" size={14} color="#00C853" />
                    <Text style={styles.weatherTipText}>{t[weather?.suggestion || 'generalGood']}</Text>
                 </View>
               </>
             )}
           </BlurView>
        </View>

        <NotificationModal 
            visible={showNotes} 
            onClose={() => setShowNotes(false)} 
            notifications={notifications}
            clear={clearNotifications}
        />

        {/* AI Farm Manager Modal */}
        <Modal 
            visible={aiModalVisible} 
            animationType="slide" 
            transparent={true}
        >
            <View style={styles.aiModalContainer}>
                <BlurView intensity={100} tint="light" style={styles.aiModalSheet}>
                    <View style={styles.aiModalHeader}>
                        <View style={styles.aiLabel}>
                            <IconSymbol name="sparkles" size={16} color={c.primary} />
                            <Text style={styles.aiLabelText}>{t.appName} AI Assistant</Text>
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
                                <Text style={[styles.thinkingText, { color: '#ff3b30', fontWeight: 'bold' }]}>🔴 ರೆಕಾರ್ಡ್ ಆಗುತ್ತಿದೆ...</Text>
                                <Text style={{ color: '#888', fontSize: 13, marginTop: 4, textAlign: 'center' }}>ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಕೇಳಿ, ನಂತರ ✋ ಒತ್ತಿ ನಿಲ್ಲಿಸಿ</Text>
                            </View>
                        )}
                        {aiThinking && !isVoiceRecording && (
                            <View style={styles.thinkingContainer}>
                                <ActivityIndicator size="large" color={c.primary} />
                                <Text style={styles.thinkingText}>ಉತ್ತರ ಹುಡುಕುತ್ತಿದ್ದೇವೆ...</Text>
                            </View>
                        )}
                        {!aiThinking && !isVoiceRecording && aiResponse ? (
                           <View style={styles.responseContainer}>
                             <Text style={styles.responseBubble}>{aiResponse}</Text>
                             <TouchableOpacity style={styles.replayBtn} onPress={() => speak(aiResponse)}>
                                <Text style={{ fontSize: 16 }}>🔊</Text>
                                <Text style={styles.replayText}>ಮತ್ತೆ ಕೇಳಿ</Text>
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
                                 ನಿಮ್ಮ ಕೃಷಿ ಪ್ರಶ್ನೆ ಕೇಳಿ ಅಥವಾ{'\n'}ಗಿಡದ ಫೋಟೋ ತೆಗೆದು ತೋರಿಸಿ 🌱
                               </Text>
                           </View>
                        )}
                    </ScrollView>

                    <View style={styles.aiInputArea}>
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
                        <TextInput
                            style={styles.aiInput}
                            placeholder="ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಇಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ..."
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
                </BlurView>
            </View>
        </Modal>

      </ScrollView>
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
                                            {n.type === 'job_match' ? '🎉' : n.type === 'worker_joined' ? '🤝' : '👤'}
                                        </Text>
                                        <Text style={styles.noteTime}>{new Date(n.createdAt).toLocaleDateString()}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.noteCardTitle}>{n.title}</Text>
                                        <Text style={styles.noteCardMsg}>{n.message}</Text>
                                        
                                        {n.type === 'worker_joined' && n.workerPhone && (
                                            <TouchableOpacity 
                                                style={styles.callActionButton}
                                                onPress={() => Linking.openURL(`tel:${n.workerPhone}`)}
                                            >
                                                <IconSymbol name="phone.fill" size={16} color="#fff" />
                                                <Text style={styles.callActionText}>Call {n.workerPhone}</Text>
                                            </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  header: { paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20, width: '100%' },
  greeting: { fontSize: 36, fontWeight: '900', color: '#fff', textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  subGreeting: { fontSize: 18, color: '#fff', marginTop: 5, fontWeight: '500' },
  voiceSection: { alignItems: 'center', marginVertical: 30, justifyContent: 'center' },
  glowRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#fff',
  },
  micButtonContainer: {
    width: 100, height: 100, borderRadius: 50, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  micBlur: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  micText: { marginTop: 15, fontSize: 16, fontWeight: 'bold', color: '#fff' },
  trackerContainer: { paddingHorizontal: 20, marginBottom: 20 },
  glassCard: { padding: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 15 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressStep: { alignItems: 'center' },
  progressLine: { flex: 1, height: 3, backgroundColor: '#ddd', marginHorizontal: 10, marginTop: -15 },
  stepText: { fontSize: 12, fontWeight: 'bold', marginTop: 5, color: '#333' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly', paddingHorizontal: 10, gap: 15 },
  card: {
    width: width * 0.42,
    aspectRatio: 1,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  cardTitle: { marginTop: 15, fontSize: 16, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  aiInsightsContainer: { padding: 25, marginTop: 10 },
  insightTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
  insightCard: { flexDirection: 'row', padding: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#E8F5E9', elevation: 3 },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00C853', marginRight: 15 },
  insightText: { fontSize: 14, color: '#2E7D32', lineHeight: 20, fontWeight: '500' },
  insightAction: { marginTop: 10, alignSelf: 'flex-start' },
  noteBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  noteBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF3D00', borderRadius: 10, paddingHorizontal: 5, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  noteBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalSheet: { width: '100%', maxHeight: '70%', borderRadius: 25, padding: 24, overflow: 'hidden' },
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
  weatherCity: { fontSize: 13, color: '#eee', fontWeight: 'bold' },
  weatherTemp: { fontSize: 38, fontWeight: '900', color: '#fff', marginTop: 5 },
  weatherCond: { fontSize: 16, color: '#fff', fontWeight: '500' },
  weatherDetails: { flexDirection: 'row', gap: 20, marginTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 15 },
  weatherItem: { },
  weatherLabel: { fontSize: 10, color: '#fff', opacity: 0.8 },
  weatherVal: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  weatherTip: { marginTop: 15, backgroundColor: 'rgba(255,255,255,0.9)', padding: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherTipText: { fontSize: 12, fontWeight: 'bold', color: '#2E7D32' },
  aiModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  aiModalSheet: { width: '100%', height: '70%', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, overflow: 'hidden' },
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
  aiInputArea: { flexDirection: 'row', gap: 12, marginTop: 20, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 20 },
  aiInput: { flex: 1, backgroundColor: '#f8f8f8', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 12, maxHeight: 100, fontSize: 16 },
  aiSendBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  micBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#00C853' },
  micPulseRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,59,48,0.2)' },
  extraBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  imagePreviewContainer: { marginVertical: 15, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 15, alignItems: 'center' },
  pickedImage: { width: width - 80, height: 200, borderRadius: 12 },
  removeImageBtn: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
});
