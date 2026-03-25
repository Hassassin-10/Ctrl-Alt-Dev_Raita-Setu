import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { Language } from '@/constants/translations';
import { useAuth } from '@/context/AuthContext';
import { useBiometric } from '@/hooks/use-biometric';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { db } from '@/services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal, Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// ── Types ──────────────────────────────────────────────────────────────────────
export type UserRole = 'Farmer' | 'Labour' | 'MachineryOwner';

interface UserProfile {
  id: string;
  role: UserRole;
  roles: string[];
  name: string;
  profilePicture?: string;
  village: string;
  landSize: string;
  landUnit: 'acres' | 'hectares';
  cropTypes: string[];
  cropStage: 'Sowing' | 'Growing' | 'Harvest' | '';
  needsLabor: boolean;
  needsMachinery: boolean;
  needsTransport: boolean;
  interestedInSchemes: boolean;
  language: Language;
  isVerified: boolean;
  totalBookings: number;
  moneySaved: number;
  jobsCompleted: number;
  totalEarnings: number;
}

const CROP_OPTIONS = [
  'Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane',
  'Tomato', 'Onion', 'Potato', 'Groundnut', 'Soybean',
];

const CROP_STAGES = ['Sowing', 'Growing', 'Harvest'] as const;
const LANGUAGES: Language[] = ['English', 'Hindi', 'Kannada'];

const defaultProfile: UserProfile = {
  id: '',
  role: 'Farmer',
  roles: [],
  name: '',
  profilePicture: '',
  village: '',
  landSize: '',
  landUnit: 'acres',
  cropTypes: [],
  cropStage: '',
  needsLabor: false,
  needsMachinery: false,
  needsTransport: false,
  interestedInSchemes: false,
  language: 'English',
  isVerified: false,
  totalBookings: 0,
  moneySaved: 0,
  jobsCompleted: 0,
  totalEarnings: 0,
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const { user, profile: authProfile, role: currentRole, language, t, setLanguage, logout, switchRole } = useAuth();
  const { status: bioStatus, isEnabled: isBioEnabled, setBiometricEnabled } = useBiometric();

  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfile>(defaultProfile);

  // Sync with auth profile
  useEffect(() => {
    if (authProfile) {
      const merged = { ...defaultProfile, ...authProfile };
      setProfile(merged);
      setTempProfile(merged);
    }
  }, [authProfile]);

  const saveProfile = useCallback(async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), tempProfile, { merge: true });
      setProfile(tempProfile);
      setIsEditing(false);
      Alert.alert('✅ Saved!', 'Your profile has been updated successfully.');
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setIsSaving(false);
    }
  }, [user, tempProfile]);

  const changeLanguage = async (newLang: Language) => {
    await setLanguage(newLang);
    setShowLangModal(false);
  };

  const startEdit = () => {
    setTempProfile({ ...profile });
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const b64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setTempProfile(p => ({ ...p, profilePicture: b64 }));
    }
  };

  const toggleCrop = (crop: string) => {
    setTempProfile((p: UserProfile) => ({
      ...p,
      cropTypes: p.cropTypes.includes(crop)
        ? p.cropTypes.filter((c: string) => c !== crop)
        : [...p.cropTypes, crop],
    }));
  };

  const handleLogout = () => {
    Alert.alert(t.logout, 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: t.logout, style: 'destructive', onPress: () => logout() },
    ]);
  };

  const displayProfile = isEditing ? tempProfile : profile;
  const farmerId = profile?.id || (user ? `RS-${user.uid.slice(0, 5).toUpperCase()}` : 'RS-XXXXX');
  const mobile = authProfile?.phone || user?.email?.split('@')[0] || t.appName;

  const handleSwitchRole = async (newRole: string) => {
    try {
      await switchRole(newRole);
      Alert.alert('Role Switched', `Now acting as ${newRole}`);
    } catch (e: any) {
      Alert.alert('Switch Failed', e.message);
    }
  };

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: c.background }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: c.primary }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity 
               style={styles.avatar} 
               onPress={isEditing ? pickImage : undefined}
               disabled={!isEditing}
            >
              {displayProfile.profilePicture ? (
                <Image source={{ uri: displayProfile.profilePicture }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{(profile.name || 'U').charAt(0).toUpperCase()}</Text>
              )}
              {isEditing && (
                <View style={styles.cameraBadge}>
                  <IconSymbol name="camera.fill" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.headerName}>{profile.name || 'User'}</Text>
              <View style={styles.badgeRow}>
                {profile.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>✓ {t.verified}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.headerSub}>📍 {profile.village || 'Location'}</Text>
              <Text style={styles.headerSub}>🪪 {farmerId}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.editBtn} onPress={isEditing ? cancelEdit : startEdit}>
              <IconSymbol name={isEditing ? 'xmark' : 'pencil'} size={14} color="#fff" />
              <Text style={styles.editBtnText}>{isEditing ? 'Cancel' : t.editProfile}</Text>
            </TouchableOpacity>
            {isEditing && (
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#FF6D00', marginLeft: 8 }]} onPress={saveProfile} disabled={isSaving}>
                {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.editBtnText}>💾 {t.saveProfile}</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.insightsStrip}>
          <InsightBox icon="📦" value={String(profile.totalBookings)} label="Bookings" color="#00C853" />
          <View style={styles.insightDivider} />
          <InsightBox icon="💰" value={`₹${profile.moneySaved}`} label="Saved" color="#FF6D00" />
          <View style={styles.insightDivider} />
          <InsightBox icon="✅" value={String(profile.jobsCompleted)} label="Completed" color="#00B0FF" />
        </View>

        <SectionCard title={`👤 ${t.basicInfo}`} color={c.surface}>
          <InfoRow label="Mobile" value={mobile} icon="📱" readonly />
          <InfoRow label="Farmer ID" value={farmerId} icon="🪪" readonly />
          <InfoRow label="Current Role" value={currentRole || 'Farmer'} icon="🎭" readonly={!isEditing} />
          {!isEditing && profile.roles && profile.roles.length > 1 && (
            <View style={{ marginBottom: 15 }}>
              <Text style={styles.inputLabel}>Switch Account Mode</Text>
              <View style={styles.roleRow}>
                {profile.roles.map((r: string) => (
                  <TouchableOpacity 
                    key={r} 
                    style={[styles.roleChip, currentRole === r && { backgroundColor: c.accent }]} 
                    onPress={() => handleSwitchRole(r)}
                  >
                    <Text style={[styles.roleChipText, currentRole === r && { color: '#fff' }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {isEditing && (
            <View style={{ marginBottom: 15 }}>
              <Text style={styles.inputLabel}>Manage My Roles</Text>
              <View style={styles.roleRow}>
                {(['Farmer', 'Labour', 'MachineryOwner'] as UserRole[]).map(r => {
                  const hasRole = tempProfile.roles?.includes(r);
                  return (
                    <TouchableOpacity 
                        key={r} 
                        style={[styles.roleChip, hasRole && { backgroundColor: c.primary }]} 
                        onPress={() => {
                            const currentRoles = tempProfile.roles || [];
                            const updatedRoles = hasRole 
                                ? currentRoles.filter((cr: string) => cr !== r)
                                : [...currentRoles, r];
                            setTempProfile(p => ({ ...p, roles: updatedRoles }));
                        }}
                    >
                      <Text style={[styles.roleChipText, hasRole && { color: '#fff' }]}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          {isEditing ? (
            <>
              <LabeledInput label="Full Name" placeholder="Enter your full name" value={tempProfile.name} onChangeText={(v: string) => setTempProfile(p => ({ ...p, name: v }))} />
              <LabeledInput label="Village / Location" placeholder="Enter village or city" value={tempProfile.village} onChangeText={(v: string) => setTempProfile(p => ({ ...p, village: v }))} />
            </>
          ) : (
            <>
              <InfoRow label="Full Name" value={profile.name || 'Not set'} icon="🧑" />
              <InfoRow label="Village" value={profile.village || 'Not set'} icon="🏘️" />
            </>
          )}
        </SectionCard>

        <SectionCard title={`🌾 ${t.farmDetails}`} color={c.surface}>
          {isEditing ? (
            <>
              <Text style={styles.inputLabel}>{t.landSize}</Text>
              <View style={styles.landRow}>
                <TextInput style={[styles.input, { flex: 1, marginRight: 10, color: '#11181C' }]} placeholder="e.g. 2.5" keyboardType="numeric" value={tempProfile.landSize} onChangeText={v => setTempProfile(p => ({ ...p, landSize: v }))} />
                <TouchableOpacity style={[styles.unitToggle, { backgroundColor: tempProfile.landUnit === 'acres' ? '#00C853' : '#eee' }]} onPress={() => setTempProfile(p => ({ ...p, landUnit: 'acres' }))}>
                  <Text style={{ color: tempProfile.landUnit === 'acres' ? '#fff' : '#333' }}>Acres</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>{t.cropTypes}</Text>
              <View style={styles.chipRow}>
                {CROP_OPTIONS.map(crop => (
                  <TouchableOpacity key={crop} style={[styles.chip, { backgroundColor: tempProfile.cropTypes.includes(crop) ? '#00C853' : '#eee' }]} onPress={() => toggleCrop(crop)}>
                    <Text style={{ color: tempProfile.cropTypes.includes(crop) ? '#fff' : '#333' }}>{crop}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>{t.cropStage}</Text>
              <View style={styles.stageRow}>
                {CROP_STAGES.map(stage => (
                  <TouchableOpacity key={stage} style={[styles.stageBtn, { backgroundColor: tempProfile.cropStage === stage ? '#00B0FF' : '#eee', flex: 1 }]} onPress={() => setTempProfile(p => ({ ...p, cropStage: stage }))}>
                    <Text style={{ color: tempProfile.cropStage === stage ? '#fff' : '#555', textAlign: 'center' }}>{stage}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <InfoRow label={t.landSize} value={profile.landSize ? `${profile.landSize} ${profile.landUnit}` : 'Not set'} icon="🗺️" />
              <InfoRow label={t.cropTypes} value={profile.cropTypes.length > 0 ? profile.cropTypes.join(', ') : 'Not set'} icon="🌱" />
              <InfoRow label={t.cropStage} value={profile.cropStage || 'Not set'} icon="📅" />
            </>
          )}
        </SectionCard>

        <SectionCard title={`🏛️ ${t.schemes}`} color={c.surface}>
          <ToggleRow label="Interested in Government Schemes" value={displayProfile.interestedInSchemes} onToggle={(v: boolean) => isEditing && setTempProfile(p => ({ ...p, interestedInSchemes: v }))} disabled={!isEditing} />
        </SectionCard>

        <SectionCard title={`⚙️ ${t.settings}`} color={c.surface}>
          <TouchableOpacity style={styles.settingsRow} onPress={() => setShowLangModal(true)}>
            <Text style={styles.settingsIcon}>🌐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsLabel}>{t.language}</Text>
              <Text style={styles.settingsValue}>{language}</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#ccc" />
          </TouchableOpacity>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsIcon}>👆</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsLabel}>Biometric Login</Text>
              <Text style={styles.settingsValue}>Fingerprint / FaceID</Text>
            </View>
            <Switch value={isBioEnabled} onValueChange={setBiometricEnabled} trackColor={{ false: '#ddd', true: '#00C853' }} />
          </View>
          <TouchableOpacity style={[styles.settingsRow, { marginTop: 8 }]} onPress={handleLogout}>
            <Text style={styles.settingsIcon}>🚪</Text>
            <Text style={[styles.settingsLabel, { color: '#FF5252', flex: 1 }]}>{t.logout}</Text>
            <IconSymbol name="chevron.right" size={20} color="#ccc" />
          </TouchableOpacity>
        </SectionCard>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showLangModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowLangModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>🌐 Select Language</Text>
            {LANGUAGES.map(l => (
              <TouchableOpacity key={l} style={[styles.langOption, { backgroundColor: language === l ? '#e8f5e9' : '#f9f9f9' }]} onPress={() => changeLanguage(l)}>
                <Text style={[styles.langText, { color: language === l ? '#00C853' : '#333' }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function SectionCard({ title, children, color }: any) {
  return (
    <View style={[styles.card, { backgroundColor: color }]}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value, icon, readonly }: any) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      {readonly && <View style={styles.readonlyBadge}><Text style={styles.readonlyText}>Auto</Text></View>}
    </View>
  );
}

function LabeledInput({ label, placeholder, value, onChangeText }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput style={styles.input} placeholder={placeholder} value={value} onChangeText={onChangeText} />
    </View>
  );
}

function ToggleRow({ label, value, onToggle, disabled }: any) {
  return (
    <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
      <Text style={{ flex: 1, fontSize: 16, color: '#333' }}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} disabled={disabled} trackColor={{ false: '#ddd', true: '#00C853' }} />
    </View>
  );
}

function InsightBox({ icon, value, label, color }: any) {
  return (
    <View style={styles.insightBox}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={[styles.insightValue, { color }]}>{value}</Text>
      <Text style={styles.insightLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 56, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#00B0FF', padding: 6, borderRadius: 12, borderWidth: 2, borderColor: '#fff' },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  headerName: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  badgeRow: { flexDirection: 'row', marginTop: 4 },
  verifiedBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  verifiedText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', marginTop: 16 },
  editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  editBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13, marginLeft: 6 },
  insightsStrip: { flexDirection: 'row', backgroundColor: '#ffffff', marginHorizontal: 20, marginTop: -20, borderRadius: 20, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, paddingVertical: 18 },
  insightBox: { flex: 1, alignItems: 'center' },
  insightDivider: { width: 1, backgroundColor: '#f0f0f0' },
  insightValue: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  insightLabel: { fontSize: 12, color: '#888' },
  card: { margin: 16, marginBottom: 0, borderRadius: 20, padding: 25, backgroundColor: '#ffffff', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoIcon: { fontSize: 22, marginRight: 12 },
  infoLabel: { fontSize: 12, color: '#999' },
  infoValue: { fontSize: 16, color: '#222', fontWeight: '500' },
  readonlyBadge: { backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  readonlyText: { fontSize: 11, color: '#00C853', fontWeight: 'bold' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 8 },
  input: { backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0', color: '#111' },
  roleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f0f0f0', flex: 1, alignItems: 'center' },
  roleChipText: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  landRow: { flexDirection: 'row', alignItems: 'center' },
  unitToggle: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  stageRow: { flexDirection: 'row', gap: 8 },
  stageBtn: { paddingVertical: 12, borderRadius: 12 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  settingsIcon: { fontSize: 22, marginRight: 14 },
  settingsLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  settingsValue: { fontSize: 13, color: '#888' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  langOption: { padding: 16, borderRadius: 14, marginBottom: 10 },
  langText: { fontSize: 17, fontWeight: '600' },
});
