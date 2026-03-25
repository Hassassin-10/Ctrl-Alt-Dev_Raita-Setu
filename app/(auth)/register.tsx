import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['Farmer']);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { register } = useAuth();
  const c = Colors[useColorScheme() ?? 'light'];
  const router = useRouter();

  const handleSendOTP = () => {
    if (!name.trim()) return Alert.alert('Error', 'Please enter your full name');
    if (phone.length < 10) return Alert.alert('Error', 'Please enter a valid mobile number');
    if (!password) return Alert.alert('Error', 'Please set a PIN/Password');
    if (password !== confirmPassword) return Alert.alert('Error', 'Passwords must match');
    
    setIsRegistering(true);
    setTimeout(() => {
      setIsRegistering(false);
      setIsOtpSent(true);
      Alert.alert('OTP Sent', `A code has been sent to +91 ${phone}. For demo, use: 123456`);
    }, 1500);
  };

  const handleRegister = async () => {
    if (otp !== '123456') {
      Alert.alert('Invalid OTP', 'The code you entered is incorrect.');
      return;
    }
    if (selectedRoles.length === 0) {
      Alert.alert('Role Required', 'Please select at least one role.');
      return;
    }
    setIsRegistering(true);
    try {
      await register(phone, password, selectedRoles, name);
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const roles = [
    { id: 'Farmer', icon: 'leaf.fill', label: 'Farmer' },
    { id: 'Labour', icon: 'person.2.fill', label: 'Labour' },
    { id: 'MachineryOwner', icon: 'gearshape.2.fill', label: 'Machinery' }
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={[c.secondary, c.primary]} style={StyleSheet.absoluteFillObject} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Image 
              source={require('../../assets/images/logo.png')} 
              style={{ width: 80, height: 80, borderRadius: 16 }} 
            />
            <Text style={styles.title}>Join Raitha Setu</Text>
            <Text style={styles.subtitle}>{isOtpSent ? 'Verify Phone' : 'Empowering Indian Farmers'}</Text>
          </View>

          <BlurView intensity={80} tint="light" style={styles.glassCard}>
            {isOtpSent ? (
              <View>
                <Text style={styles.cardSubtitle}>Enter the 6-digit code sent to {'\n'} <Text style={{ fontWeight: 'bold' }}>+91 {phone}</Text></Text>
                <TextInput
                  style={[styles.input, { textAlign: 'center', letterSpacing: 8, fontSize: 22 }]}
                  placeholder="000000"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="numeric"
                  maxLength={6}
                />
                <TouchableOpacity style={[styles.loginBtn, { backgroundColor: c.cta }]} onPress={handleRegister} disabled={isRegistering}>
                  {isRegistering ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginText}>Verify & Create Account</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setIsOtpSent(false)}>
                  <Text style={{ color: '#444' }}>Back to edit details</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.cardSubtitle}>Choose your role to get started</Text>

                <View style={styles.roleContainer}>
                  {roles.map((item) => {
                    const isSelected = selectedRoles.includes(item.id);
                    return (
                      <TouchableOpacity 
                        key={item.id}
                        style={[
                          styles.roleCard, 
                          isSelected && { backgroundColor: c.cta, borderColor: c.cta }
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedRoles(selectedRoles.filter(r => r !== item.id));
                          } else {
                            setSelectedRoles([...selectedRoles, item.id]);
                          }
                        }}
                      >
                        <IconSymbol 
                          name={item.icon as any} 
                          size={24} 
                          color={isSelected ? '#fff' : c.primary} 
                        />
                        <Text style={[styles.roleText, isSelected && { color: '#fff' }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.input} 
                  placeholder="Full Name" 
                  placeholderTextColor="#666"
                  value={name} 
                  onChangeText={setName} 
                />

                <TextInput
                  style={styles.input} 
                  placeholder="Mobile Number" 
                  placeholderTextColor="#666"
                  value={phone} 
                  onChangeText={setPhone} 
                  keyboardType="phone-pad" 
                />
                
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]} 
                    placeholder="Create PIN (Password)" 
                    placeholderTextColor="#666"
                    value={password} 
                    onChangeText={setPassword} 
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon} 
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]} 
                    placeholder="Confirm PIN" 
                    placeholderTextColor="#666"
                    value={confirmPassword} 
                    onChangeText={setConfirmPassword} 
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon} 
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={22} color="#666" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.loginBtn, { backgroundColor: c.cta }]} onPress={handleSendOTP} disabled={isRegistering}>
                  {isRegistering ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginText}>Send OTP</Text>}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.registerLink} onPress={() => router.back()}>
              <Text style={styles.registerText}>
                Already have an account? <Text style={{ color: c.cta, fontWeight: 'bold' }}>Log In</Text>
              </Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginVertical: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  subtitle: { fontSize: 18, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  glassCard: { 
    width: '100%', 
    padding: 30, 
    borderRadius: 25, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.5)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20
  },
  cardSubtitle: { fontSize: 16, color: '#444', textAlign: 'center', marginBottom: 20 },
  roleContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 25 
  },
  roleCard: { 
    width: '31%', 
    aspectRatio: 1, 
    backgroundColor: 'rgba(255,255,255,0.8)', 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)'
  },
  roleText: { 
    fontSize: 11, 
    fontWeight: '600', 
    marginTop: 5, 
    textAlign: 'center',
    color: '#333'
  },
  input: { 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    borderRadius: 15, 
    padding: 15, 
    fontSize: 16, 
    marginBottom: 15, 
    color: '#111',
    borderWidth: 1,
    borderColor: '#ccc'
  },
  passwordContainer: { position: 'relative', width: '100%' },
  passwordInput: { paddingRight: 50 },
  eyeIcon: { position: 'absolute', right: 15, top: 16, zIndex: 1 },
  loginBtn: { 
    padding: 15, 
    borderRadius: 15, 
    alignItems: 'center', 
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3
  },
  loginText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  registerLink: { marginTop: 20, alignItems: 'center' },
  registerText: { color: '#333', fontSize: 14 }
});
