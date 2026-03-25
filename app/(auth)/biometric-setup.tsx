/**
 * Biometric Enable Prompt — shown once after first successful login
 * Asks the user if they want to enable fingerprint login
 */

import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useBiometric } from '@/hooks/use-biometric';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_PROMPTED_KEY = '@kisaan_bio_prompted';

export default function BiometricSetupScreen() {
  const { biometricLabel, setBiometricEnabled } = useBiometric();
  const router = useRouter();

  const handleEnable = async () => {
    await setBiometricEnabled(true);
    await AsyncStorage.setItem(BIOMETRIC_PROMPTED_KEY, 'true');
    router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    await setBiometricEnabled(false);
    await AsyncStorage.setItem(BIOMETRIC_PROMPTED_KEY, 'true');
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#00C853', '#00897B']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>👆</Text>
        </View>

        <Text style={styles.title}>Enable {biometricLabel} Login?</Text>
        <Text style={styles.desc}>
          Login faster and securely with just your fingerprint — no password needed every time.
        </Text>

        <View style={styles.features}>
          {['⚡ Instant one-touch login', '🔒 100% secure — stored on device only', '🌾 Farmer-friendly, no typing needed'].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.enableBtn} onPress={handleEnable}>
          <Text style={styles.enableText}>👆 Enable {biometricLabel} Login</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Not now, I'll use password</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  icon: { fontSize: 58 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 14 },
  desc: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  features: { width: '100%', marginBottom: 36 },
  featureRow: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 14, marginBottom: 10 },
  featureText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  enableBtn: { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 18, alignItems: 'center', marginBottom: 14, elevation: 4 },
  enableText: { color: '#00C853', fontSize: 18, fontWeight: 'bold' },
  skipBtn: { padding: 12 },
  skipText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, textDecorationLine: 'underline' },
});
