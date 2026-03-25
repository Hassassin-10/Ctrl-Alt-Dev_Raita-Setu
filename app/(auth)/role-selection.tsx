import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

export default function RoleSelectionScreen() {
  const [role, setRole] = useState('Farmer');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const c = Colors[useColorScheme() ?? 'light'];
  const router = useRouter();

  const handleSaveRole = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Generate/Assign a default RS-ID if it's a new profile
      const rsId = `RS-${user.uid.slice(0, 5).toUpperCase()}`;

      await setDoc(doc(db, 'users', user.uid), {
        id: rsId, // Fallback RS-ID
        roles: [role],
        activeRole: role,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      // Also update legacy for safety
      await setDoc(doc(db, 'farmers', user.uid), { role }, { merge: true });
      
      // Navigate to tabs
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    { id: 'Farmer', icon: 'leaf.fill', label: 'Farmer' },
    { id: 'Labour', icon: 'person.2.fill', label: 'Labour' },
    { id: 'MachineryOwner', icon: 'gearshape.2.fill', label: 'Machine Owner' }
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={[c.secondary, c.primary]} style={StyleSheet.absoluteFillObject} />
      
      <View style={styles.content}>
        <BlurView intensity={80} tint="light" style={styles.glassCard}>
          <Text style={styles.title}>Welcome to Raitha Setu</Text>
          <Text style={styles.subtitle}>Please select your role to continue</Text>

          <View style={styles.roleContainer}>
            {roles.map((item) => (
              <TouchableOpacity 
                key={item.id}
                style={[
                  styles.roleCard, 
                  role === item.id && { backgroundColor: c.cta, borderColor: c.cta }
                ]}
                onPress={() => setRole(item.id)}
              >
                <IconSymbol 
                  name={item.icon as any} 
                  size={32} 
                  color={role === item.id ? '#fff' : c.primary} 
                />
                <Text style={[styles.roleText, role === item.id && { color: '#fff' }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: c.cta }, isLoading && { opacity: 0.7 }]} 
            onPress={handleSaveRole}
            disabled={isLoading}
          >
            <Text style={styles.saveBtnText}>Continue →</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  glassCard: { 
    width: '100%', 
    padding: 30, 
    borderRadius: 25, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.5)',
    elevation: 10
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#444', textAlign: 'center', marginBottom: 30 },
  roleContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 35 
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
    fontSize: 12, 
    fontWeight: '600', 
    marginTop: 8, 
    textAlign: 'center',
    color: '#333'
  },
  saveBtn: { 
    padding: 16, 
    borderRadius: 15, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3
  },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
