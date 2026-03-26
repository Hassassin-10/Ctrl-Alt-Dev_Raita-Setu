import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Animated, ScrollView, Image
} from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBiometric } from '@/hooks/use-biometric';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isBioLoading, setIsBioLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const { login, t } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const router = useRouter();
  const { status, biometricLabel, authenticate, isEnabled } = useBiometric();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 1. Setup pulsing animation
  useEffect(() => {
    if (status === 'available') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [status, pulseAnim]);

  // 2. Auto-trigger only if user HAS enabled biometrics previously
  useEffect(() => {
    if (status === 'available' && isEnabled && !showForm) {
      handleBiometricLogin();
    }
  }, [status, isEnabled]);

  const handleBiometricLogin = async () => {
    setIsBioLoading(true);
    try {
      const result = await authenticate();
      
      if (result.success) {
        const savedPhone = await SecureStore.getItemAsync('user_phone');
        const savedPass = await SecureStore.getItemAsync('user_password');

        if (savedPhone && savedPass) {
          await login(savedPhone, savedPass);
        } else {
          Alert.alert(
            'Setup Required',
            'To use biometrics, please login once with your mobile and password first.',
            [{ text: 'OK', onPress: () => setShowForm(true) }]
          );
        }
      } else if (result.error && !result.error.toLowerCase().includes('cancel')) {
        Alert.alert('Biometric Error', result.error);
        setShowForm(true);
      }
    } catch (err: any) {
      Alert.alert('System Error', 'Could not access biometric hardware.');
    } finally {
      setIsBioLoading(false);
    }
  };

  const handleSendOTP = () => {
    if (phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid mobile number.');
      return;
    }
    setIsLoggingIn(true);
    // Simulate OTP Send
    setTimeout(() => {
      setIsLoggingIn(false);
      setIsOtpSent(true);
      Alert.alert('OTP Sent', `A verification code has been sent to +91 ${phone}. For demo, use: 123456`);
    }, 1500);
  };

  const handleLogin = async () => {
    if (!phone) {
      Alert.alert('Missing Number', 'Please enter your mobile number.');
      return;
    }
    
    // If OTP mode is active, check the code
    if (isOtpSent && otp !== '123456') {
      Alert.alert('Invalid OTP', 'The code you entered is incorrect. For demo, use: 123456');
      return;
    }

    setIsLoggingIn(true);
    try {
      // If they used OTP, we use a fallback PIN to let them in for the demo
      // If they used the password field, we use that.
      const loginPass = isOtpSent ? (password || '123456') : password;
      
      if (!loginPass) {
          throw new Error("Please enter your PIN or use OTP");
      }

      await login(phone, loginPass);
      
      // Save for Biometrics
      await SecureStore.setItemAsync('user_phone', phone);
      await SecureStore.setItemAsync('user_password', loginPass);
      
    } catch (e: any) {
      const msg = e.message.includes('auth/invalid-credential') 
        ? 'Incorrect mobile number or PIN. \n\nTip: If you forgot your PIN, use the "Login with OTP" option.' 
        : e.message;
      Alert.alert('Login Failed', msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <LinearGradient colors={[c.primary, c.accent]} style={styles.topSection}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/logo.png')} 
            style={{ width: 100, height: 100, borderRadius: 20 }} 
          />
          <Text style={styles.appName}>{t.appName}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.welcomeBack}</Text>
          <Text style={styles.subtitle}>{isOtpSent ? 'Verify your identitiy' : t.loginSub}</Text>
        </View>

        <BlurView intensity={70} tint="light" style={styles.glassCard}>
          {/* Primary View: If Biometrics is enabled & ready, show the full bio screen */}
          {status === 'available' && isEnabled && !showForm ? (
            <View style={styles.bioSection}>
              <Text style={styles.bioTitle}>Unlock with {biometricLabel}</Text>
              <Text style={styles.bioSubtitle}>Biometric login is enabled for your profile</Text>

              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={[styles.fingerBtn, isBioLoading && styles.fingerBtnDisabled]}
                  onPress={handleBiometricLogin}
                  disabled={isBioLoading}
                >
                  {isBioLoading ? (
                    <ActivityIndicator size="large" color="#fff" />
                  ) : (
                    <Text style={styles.fingerIcon}>
                      {biometricLabel === 'Face ID' ? '😊' : '👆'}
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

              <Text style={styles.bioHint}>
                {isBioLoading ? 'Authenticating...' : `Place your finger on the sensor`}
              </Text>

              <TouchableOpacity
                style={styles.fallbackLink}
                onPress={() => setShowForm(true)}
              >
                <Text style={styles.fallbackText}>🔑 Login with Mobile/OTP</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {isOtpSent ? (
                 <>
                   <Text style={{ textAlign: 'center', marginBottom: 15, color: '#444' }}>Verification code sent to {'\n'} <Text style={{ fontWeight: 'bold' }}>+91 {phone}</Text></Text>
                   <TextInput
                    style={[styles.input, { textAlign: 'center', letterSpacing: 10, fontSize: 24 }]}
                    placeholder="000000"
                    placeholderTextColor="#ccc"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="numeric"
                    maxLength={6}
                   />
                   <TouchableOpacity 
                    style={[styles.loginBtn, { backgroundColor: c.primary }]} 
                    onPress={handleLogin}
                    disabled={isLoggingIn}
                   >
                     {isLoggingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginText}>Verify & Login</Text>}
                   </TouchableOpacity>
                   <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setIsOtpSent(false)}>
                      <Text style={{ color: '#666' }}>Change Phone Number</Text>
                   </TouchableOpacity>
                 </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Mobile Number"
                    placeholderTextColor="#888"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="Password (PIN)"
                      placeholderTextColor="#888"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!isPasswordVisible}
                    />
                    <TouchableOpacity 
                      style={styles.eyeBtn} 
                      onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                    >
                      <IconSymbol 
                        name={isPasswordVisible ? 'eye.slash' : 'eye'} 
                        size={20} 
                        color="#666" 
                      />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.loginBtn, { backgroundColor: c.primary }, (!phone || !password || isLoggingIn) && { opacity: 0.5 }]}
                    onPress={handleLogin}
                    disabled={!phone || !password || isLoggingIn}
                  >
                    {isLoggingIn && !isOtpSent
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.loginText}>Login with PIN</Text>
                    }
                  </TouchableOpacity>

                  <View style={styles.orRow}>
                      <View style={styles.orLine} /><Text style={styles.orText}>OR</Text><View style={styles.orLine} />
                  </View>

                  <TouchableOpacity
                    style={[styles.otpLink, isLoggingIn && { opacity: 0.7 }]}
                    onPress={handleSendOTP}
                    disabled={isLoggingIn}
                  >
                    <IconSymbol name="message.fill" size={18} color={c.cta} />
                    <Text style={[styles.otpLinkText, { color: c.cta }]}>Login with OTP (123456)</Text>
                  </TouchableOpacity>
                </>
              )}

              {status === 'available' && (
                <TouchableOpacity style={styles.bioFallbackBtn} onPress={handleBiometricLogin}>
                  <Text style={{ fontSize: 22 }}>{biometricLabel === 'Face ID' ? '😊' : '👆'}</Text>
                  <Text style={styles.bioFallbackText}>Use {biometricLabel}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.registerLink}
                onPress={() => router.push('/(auth)/register')}
              >
                <Text style={styles.registerText}>
                  New to {t.appName}? <Text style={{ color: c.cta, fontWeight: 'bold' }}>Register Here</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'not_enrolled' && (
            <View style={styles.statusBanner}>
              <Text style={styles.statusText}>⚠️ Add a fingerprint in device Settings to enable biometric login.</Text>
            </View>
          )}
        </BlurView>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSection: { padding: 40, paddingTop: 80, alignItems: 'center', borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  logoContainer: { alignItems: 'center' },
  appName: { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: 10, letterSpacing: 1 },
  formContainer: { padding: 24 },
  header: { marginBottom: 30, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
  glassCard: { padding: 25, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  input: { backgroundColor: '#f9f9f9', borderRadius: 15, padding: 16, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  loginBtn: { padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 5, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  loginText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  passwordContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f9f9f9', 
    borderRadius: 15, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: '#eee',
    overflow: 'hidden'
  },
  eyeBtn: { padding: 15 },
  registerLink: { marginTop: 25, alignItems: 'center' },
  registerText: { color: '#444', fontSize: 15 },
  bioSection: { alignItems: 'center', paddingVertical: 10 },
  bioTitle: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  bioSubtitle: { fontSize: 15, color: '#555', marginTop: 6, marginBottom: 30 },
  fingerBtn: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#00C853', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  fingerBtnDisabled: { backgroundColor: '#aaa' },
  fingerIcon: { fontSize: 48 },
  bioHint: { marginTop: 15, fontSize: 14, color: '#666' },
  fallbackLink: { marginTop: 25, paddingVertical: 5 },
  fallbackText: { fontSize: 15, color: '#00C853', fontWeight: 'bold' },
  bioFallbackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, backgroundColor: '#e8f5e9', padding: 15, borderRadius: 15 },
  bioFallbackText: { marginLeft: 10, fontSize: 16, fontWeight: 'bold', color: '#00C853' },
  statusBanner: { backgroundColor: '#FFF9C4', padding: 12, borderRadius: 12, marginTop: 20 },
  statusText: { fontSize: 13, color: '#827717', textAlign: 'center' },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  orLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  orText: { marginHorizontal: 15, color: '#999', fontWeight: 'bold', fontSize: 12 },
  otpLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 10 },
  otpLinkText: { fontWeight: 'bold', fontSize: 16 }
});
