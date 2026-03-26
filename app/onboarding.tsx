import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions, Platform } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();

  // Form State
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [primaryCrop, setPrimaryCrop] = useState('');
  const [landSize, setLandSize] = useState('');
  const [cropStage, setCropStage] = useState('');
  const [needsLogic, setNeedsLogic] = useState({ labor: false, machinery: false, transport: false, schemes: true });

  const crops = ["Wheat", "Rice", "Cotton", "Sugarcane", "Maize"];
  const stages = ["Sowing", "Growing", "Harvest"];

  const handleNext = () => {
    if (step === 1 && (!name || !village || !primaryCrop)) {
      Alert.alert("Missing Fields", "Please fill out your Name, Village, and pick a Primary Crop!");
      return;
    }
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSaveProfile = async () => {
    try {
      if (user) {
        await setDoc(doc(db, "farmers", user.uid), {
          fullName: name,
          mobileNumber: user.phoneNumber || user.email, 
          village,
          primaryCrop,
          landSize: landSize ? `${landSize} Acres` : 'Not Specified',
          cropStage,
          needs: needsLogic,
          isVerified: true, // Mock Verification Badge
          completedOnboarding: true
        }, { merge: true });
      }
      
      // Navigate cleanly to Main Dashboard
      router.replace('/(tabs)');
      Alert.alert("Profile Saved!", "Welcome to Raitha Setu.");

    } catch (error: any) {
      Alert.alert("Database Error", error.message);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.progressContainer}>
        <View style={[styles.progressDot, step >= 1 && { backgroundColor: c.cta }]} />
        <View style={[styles.progressLine, step >= 2 && { backgroundColor: c.cta }]} />
        <View style={[styles.progressDot, step >= 2 && { backgroundColor: c.cta }]} />
        <View style={[styles.progressLine, step >= 3 && { backgroundColor: c.cta }]} />
        <View style={[styles.progressDot, step >= 3 && { backgroundColor: c.cta }]} />
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={[c.primary, c.accent]} style={StyleSheet.absoluteFillObject} />
      
      <ScrollView contentContainerStyle={styles.content}>
        <BlurView intensity={80} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={styles.glassCard}>
          
          <Text style={styles.title}>Farmer Setup</Text>
          <Text style={styles.subtitle}>Step {step} of 3</Text>
          
          {renderStepIndicator()}

          {/* STEP 1: Basic Details */}
          {step === 1 && (
            <View style={styles.formSection}>
               <Text style={styles.label}>Full Name *</Text>
               <TextInput style={styles.input} placeholder="e.g. Ramesh Kumar" value={name} onChangeText={setName} />
               
               <Text style={styles.label}>Village / Location *</Text>
               <TextInput style={styles.input} placeholder="Auto-detect or type..." value={village} onChangeText={setVillage} />
               
               <Text style={styles.label}>Primary Crop *</Text>
               <View style={styles.chipRow}>
                 {crops.map(c => (
                   <TouchableOpacity key={c} style={[styles.chip, primaryCrop === c && styles.chipActive]} onPress={() => setPrimaryCrop(c)}>
                      <Text style={[styles.chipText, primaryCrop === c && styles.chipTextActive]}>{c}</Text>
                   </TouchableOpacity>
                 ))}
               </View>
            </View>
          )}

          {/* STEP 2: Farm Details */}
          {step === 2 && (
            <View style={styles.formSection}>
               <Text style={styles.label}>Land Size (Optional)</Text>
               <TextInput style={styles.input} placeholder="e.g. 2.5 (in Acres)" keyboardType="numeric" value={landSize} onChangeText={setLandSize} />
               
               <Text style={styles.label}>Current Crop Stage</Text>
               <View style={styles.chipRow}>
                 {stages.map(s => (
                   <TouchableOpacity key={s} style={[styles.chip, cropStage === s && styles.chipActive]} onPress={() => setCropStage(s)}>
                      <Text style={[styles.chipText, cropStage === s && styles.chipTextActive]}>{s}</Text>
                   </TouchableOpacity>
                 ))}
               </View>
            </View>
          )}

          {/* STEP 3: Operational Needs */}
          {step === 3 && (
            <View style={styles.formSection}>
               <Text style={styles.label}>What do you need help with right now?</Text>
               
               <TouchableOpacity style={[styles.toggleRow, needsLogic.labor && styles.toggleRowActive]} onPress={() => setNeedsLogic({...needsLogic, labor: !needsLogic.labor})}>
                  <IconSymbol name="person.fill" size={24} color={needsLogic.labor ? '#fff' : '#666'} />
                  <Text style={[styles.toggleText, needsLogic.labor && { color: '#fff' }]}>Labor Hiring</Text>
                  {needsLogic.labor && <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />}
               </TouchableOpacity>

               <TouchableOpacity style={[styles.toggleRow, needsLogic.machinery && styles.toggleRowActive]} onPress={() => setNeedsLogic({...needsLogic, machinery: !needsLogic.machinery})}>
                  <IconSymbol name="cart.fill" size={24} color={needsLogic.machinery ? '#fff' : '#666'} />
                  <Text style={[styles.toggleText, needsLogic.machinery && { color: '#fff' }]}>Machinery Rental</Text>
                  {needsLogic.machinery && <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />}
               </TouchableOpacity>

               <TouchableOpacity style={[styles.toggleRow, needsLogic.schemes && styles.toggleRowActive]} onPress={() => setNeedsLogic({...needsLogic, schemes: !needsLogic.schemes})}>
                  <IconSymbol name="book.fill" size={24} color={needsLogic.schemes ? '#fff' : '#666'} />
                  <Text style={[styles.toggleText, needsLogic.schemes && { color: '#fff' }]}>Govt Schemes (AI Help)</Text>
                  {needsLogic.schemes && <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />}
               </TouchableOpacity>
            </View>
          )}

          {/* Nav Buttons */}
          <View style={styles.buttonRow}>
             {step > 1 ? (
                <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                   <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
             ) : <View style={{ flex: 1 }} />}
             
             {step < 3 ? (
                <TouchableOpacity style={[styles.nextBtn, { backgroundColor: c.cta }]} onPress={handleNext}>
                   <Text style={styles.nextText}>Continue</Text>
                </TouchableOpacity>
             ) : (
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#00C853' }]} onPress={handleSaveProfile}>
                   <Text style={styles.nextText}>Save & Enter App</Text>
                </TouchableOpacity>
             )}
          </View>

        </BlurView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  glassCard: { padding: 30, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', elevation: 5 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#111', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 20 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ddd' },
  progressLine: { width: 40, height: 3, backgroundColor: '#ddd', marginHorizontal: 5 },
  formSection: { minHeight: 250 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 10, marginTop: 10 },
  input: { backgroundColor: 'rgba(255,255,255,0.8)', padding: 15, borderRadius: 12, fontSize: 16, color: '#111', marginBottom: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  chip: { backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  chipActive: { backgroundColor: '#00C853', borderColor: '#00C853' },
  chipText: { color: '#555', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', padding: 15, borderRadius: 15, marginBottom: 15 },
  toggleRowActive: { backgroundColor: '#FF6D00' },
  toggleText: { flex: 1, marginLeft: 15, fontSize: 16, fontWeight: 'bold', color: '#333' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  backBtn: { flex: 1, padding: 15, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', marginRight: 10 },
  backText: { color: '#333', fontWeight: 'bold', fontSize: 16 },
  nextBtn: { flex: 1.5, padding: 15, borderRadius: 15, alignItems: 'center' },
  saveBtn: { flex: 1.5, padding: 15, borderRadius: 15, alignItems: 'center' },
  nextText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
