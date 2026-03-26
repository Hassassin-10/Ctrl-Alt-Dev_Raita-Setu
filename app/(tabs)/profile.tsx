import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { Language } from '@/constants/translations';
import { useAuth } from '@/context/AuthContext';
import { useBiometric } from '@/hooks/use-biometric';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { db } from '@/services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import * as NotificationsService from '@/services/notifications';
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
  Platform
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

// ── Types ──────────────────────────────────────────────────────────────────────
export type UserRole = 'Farmer' | 'Labour' | 'MachineryOwner';

interface UserProfile {
  id: string;
  role: UserRole;
  roles: string[];
  fullName: string;
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
  dailyReminder: boolean;
  reminderHour: number;
  reminderMinute: number;
  profileImage?: string;
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
  fullName: '',
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
  dailyReminder: false,
  reminderHour: 8,
  reminderMinute: 0,
  profileImage: undefined,
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const { user, profile: authProfile, role: currentRole, language, t, setLanguage, logout, switchRole } = useAuth();
  const { status: bioStatus, isEnabled: isBioEnabled, setBiometricEnabled } = useBiometric();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfile>(defaultProfile);
  const [showTimePicker, setShowTimePicker] = useState(false);

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

  const toggleSchemes = async (value: boolean) => {
    if (isEditing) {
      setTempProfile(p => ({ ...p, interestedInSchemes: value }));
      return;
    }

    // Immediate update if not editing
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { interestedInSchemes: value }, { merge: true });
      setProfile(p => ({ ...p, interestedInSchemes: value }));
      setTempProfile(p => ({ ...p, interestedInSchemes: value }));
    } catch (e: any) {
      Alert.alert('Update Failed', e.message);
    }
  };

  const startEdit = () => {
    setTempProfile({ ...profile });
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const toggleCrop = (crop: string) => {
    setTempProfile((p: UserProfile) => ({
      ...p,
      cropTypes: p.cropTypes.includes(crop)
        ? p.cropTypes.filter((c: string) => c !== crop)
        : [...p.cropTypes, crop],
    }));
  };

  const toggleReminder = async (value: boolean) => {
    if (isEditing) {
      setTempProfile(p => ({ ...p, dailyReminder: value }));
      return;
    }

    if (!user) return;
    try {
      if (value) {
        const granted = await NotificationsService.requestNotificationPermissions();
        if (granted) {
          await NotificationsService.scheduleDailyReminder(8, 0); // 8 AM
          Alert.alert('🔔 Reminder On', 'We will send you a daily farm update at 8:00 AM.');
        } else {
          Alert.alert('Permission Denied', 'Please enable notifications in your device settings.');
          return;
        }
      } else {
        await NotificationsService.cancelDailyReminder();
        Alert.alert('🔕 Reminder Off', 'Daily reminders have been disabled.');
      }

      await setDoc(doc(db, 'users', user.uid), { dailyReminder: value }, { merge: true });
      setProfile(p => ({ ...p, dailyReminder: value }));
      setTempProfile(p => ({ ...p, dailyReminder: value }));
    } catch (e: any) {
      Alert.alert('Update Failed', e.message);
    }
  };

  const updateReminderTime = async (h: number, m: number) => {
    if (!profile.dailyReminder) return;

    try {
      if (!user) return;
      await NotificationsService.scheduleDailyReminder(h, m);
      await setDoc(doc(db, 'users', user.uid), { reminderHour: h, reminderMinute: m }, { merge: true });
      setProfile(p => ({ ...p, reminderHour: h, reminderMinute: m }));
      setTempProfile(p => ({ ...p, reminderHour: h, reminderMinute: m }));
    } catch (e: any) {
      Alert.alert('Update Failed', e.message);
    }
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      updateReminderTime(selectedDate.getHours(), selectedDate.getMinutes());
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setTempProfile(p => ({ ...p, profileImage: result.assets[0].uri }));
    }
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

  const handleSwitchRole = async (newRole: UserRole) => {
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
              activeOpacity={isEditing ? 0.7 : 1}
            >
              {displayProfile.profileImage ? (
                <Image source={{ uri: displayProfile.profileImage }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{(displayProfile.fullName || 'F').charAt(0).toUpperCase()}</Text>
              )}
              {isEditing && (
                <View style={styles.avatarEditOverlay}>
                  <IconSymbol name="camera.fill" size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.headerName}>{profile.fullName || 'User'}</Text>
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

        {/* 1. PROFESSIONAL IDENTITY */}
        <SectionCard title={`💼 ${t.roles || 'Professional Identity'}`} color={c.surface}>
          {!isEditing ? (
            <>
              <Text style={styles.subCardLabel}>Switch Role (Act As)</Text>
              <View style={styles.roleGrid}>
                {(['Farmer', 'Labour', 'MachineryOwner'] as UserRole[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleBigCard,
                      currentRole === r && {
                        borderColor: r === 'Labour' ? '#FF6D00' : c.primary,
                        borderWidth: 2,
                        backgroundColor: r === 'Labour' ? '#FFF3E0' : '#E8F5E9'
                      }
                    ]}
                    onPress={() => handleSwitchRole(r)}
                  >
                    <Text style={{ fontSize: 24, marginBottom: 5 }}>
                      {r === 'Farmer' ? '🚜' : r === 'Labour' ? '👷' : '🏛️'}
                    </Text>
                    <Text 
                      style={[
                        styles.roleCardTitle, 
                        currentRole === r && { color: r === 'Labour' ? '#E65100' : c.primary },
                        r === 'MachineryOwner' && { fontSize: 11 }
                      ]}
                      numberOfLines={2}
                    >
                      {r === 'MachineryOwner' ? 'Machinery\nOwner' : r}
                    </Text>
                    {currentRole === r && (
                      <View style={[styles.activeIndicator, { backgroundColor: r === 'Labour' ? '#FF6D00' : c.primary }]}>
                        <Text style={styles.activeText}>Active</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <View>
              <Text style={styles.subCardLabel}>Enable My Professional Skills</Text>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 15, marginTop: -5 }}>Choose the roles you can perform to get relevant jobs and leads.</Text>
              <View style={styles.roleGrid}>
                {(['Farmer', 'Labour', 'MachineryOwner'] as UserRole[]).map(r => {
                  const hasRole = tempProfile.roles?.includes(r);
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleBigCard, hasRole && { borderColor: c.primary, borderWidth: 1.5, backgroundColor: '#f9f9f9' }]}
                      onPress={() => {
                        const currentRoles = tempProfile.roles || [];
                        const updatedRoles = hasRole
                          ? currentRoles.filter((cr: string) => cr !== r)
                          : [...currentRoles, r];
                        setTempProfile(p => ({ ...p, roles: updatedRoles }));
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{r === 'Farmer' ? '🚜' : r === 'Labour' ? '👷' : '🏛️'}</Text>
                      <Text 
                        style={[styles.roleCardTitle, r === 'MachineryOwner' && { fontSize: 11 }]}
                      >
                        {r === 'MachineryOwner' ? 'Machinery\nOwner' : r}
                      </Text>
                      <View style={[styles.checkbox, hasRole && { backgroundColor: c.primary, borderColor: c.primary }]}>
                        {hasRole && <IconSymbol name="checkmark" size={12} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </SectionCard>

        {/* 2. PERSONAL INFORMATION */}
        <SectionCard title={`👤 ${t.basicInfo}`} color={c.surface}>
          {isEditing ? (
            <>
              <LabeledInput label="Full Name" placeholder="Enter your full name" value={tempProfile.fullName} onChangeText={(v: string) => setTempProfile(p => ({ ...p, fullName: v }))} />
              <LabeledInput label="Place / Location" placeholder="Enter place or city" value={tempProfile.village} onChangeText={(v: string) => setTempProfile(p => ({ ...p, village: v }))} />
            </>
          ) : (
            <>
              <InfoRow label="Full Name" value={profile.fullName || 'Not set'} icon="🧑" />
              <InfoRow label="Place" value={profile.village || 'Not set'} icon="🏘️" />
            </>
          )}
          <InfoRow label="Mobile" value={mobile} icon="📱" readonly />
          <InfoRow label="Farmer ID" value={farmerId} icon="🪪" readonly />
        </SectionCard>

        {/* 3. FARM DETAILS */}
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

        {/* 4. GOVERNMENT SCHEMES */}
        <SectionCard title={`🏛️ ${t.schemes}`} color={c.surface}>
          <ToggleRow
            label="Enable Scheme Notifications"
            value={displayProfile.interestedInSchemes}
            onToggle={toggleSchemes}
          />

          {displayProfile.interestedInSchemes && (
            <View style={styles.eligibilityCard}>
              <Text style={styles.eligibilityTitle}>📋 Eligibility for Schemes</Text>
              <View style={styles.criteriaRow}>
                <IconSymbol name="checkmark.circle.fill" size={16} color={profile.isVerified ? '#00C853' : '#ccc'} />
                <Text style={[styles.criteriaText, !profile.isVerified && { color: '#999' }]}>Verified Farmer Profile</Text>
              </View>
              <View style={styles.criteriaRow}>
                <IconSymbol name="checkmark.circle.fill" size={16} color={profile.landSize ? '#00C853' : '#ccc'} />
                <Text style={[styles.criteriaText, !profile.landSize && { color: '#999' }]}>Valid Land Records Added</Text>
              </View>
              <View style={styles.criteriaRow}>
                <IconSymbol name="checkmark.circle.fill" size={16} color={profile.village ? '#00C853' : '#ccc'} />
                <Text style={[styles.criteriaText, !profile.village && { color: '#999' }]}>Local Village Verification</Text>
              </View>
              <View style={styles.criteriaRow}>
                <IconSymbol name="checkmark.circle.fill" size={16} color="#00C853" />
                <Text style={styles.criteriaText}>Aadhaar Linked Account</Text>
              </View>

              {!profile.isVerified && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>⚠️ Please complete your KYC to unlock all government benefits.</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.browseSchemesBtn, { marginTop: 20, backgroundColor: '#fff', borderColor: '#00C853', borderWidth: 1.5 }]}
                onPress={() => router.push('/(tabs)/schemes')}
              >
                <View style={[styles.schemeIconBox, { backgroundColor: '#E8F5E9' }]}>
                  <IconSymbol name="book.fill" size={20} color="#00C853" />
                </View>
                <Text style={[styles.browseSchemesText, { color: '#1B5E20' }]}>Browse & Apply for Schemes</Text>
                <IconSymbol name="chevron.right" size={20} color="#00C853" />
              </TouchableOpacity>
            </View>
          )}
        </SectionCard>

        {/* 5. APP SETTINGS */}
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
          <View style={styles.settingsRow}>
            <Text style={styles.settingsIcon}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsLabel}>Daily App Reminder</Text>
              <Text style={styles.settingsValue}>Morning Farm Update (8 AM)</Text>
            </View>
            <Switch
              value={displayProfile.dailyReminder}
              onValueChange={toggleReminder}
              trackColor={{ false: '#ddd', true: '#FF6D00' }}
            />
          </View>
          {displayProfile.dailyReminder && (
            <View style={styles.timePickerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.timeLabel}>Reminder Time</Text>
                <Text style={styles.timeValue}>{String(displayProfile.reminderHour).padStart(2, '0')}:{String(displayProfile.reminderMinute).padStart(2, '0')}</Text>
              </View>
              <TouchableOpacity
                style={styles.clockButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={{ fontSize: 24 }}>⏰</Text>
                <Text style={styles.clockBtnText}>Change Time</Text>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={(() => {
                    const d = new Date();
                    d.setHours(displayProfile.reminderHour || 8);
                    d.setMinutes(displayProfile.reminderMinute || 0);
                    return d;
                  })()}
                  mode="time"
                  is24Hour={true}
                  display={Platform.OS === 'android' ? 'clock' : 'default'}
                  onChange={onTimeChange}
                />
              )}
            </View>
          )}
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
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarEditOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 25, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  headerName: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  badgeRow: { flexDirection: 'row', marginTop: 4 },
  verifiedBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  verifiedText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', marginTop: 16 },
  editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  editBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13, marginLeft: 6 },
  insightsStrip: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 20, marginTop: -20, borderRadius: 18, elevation: 5, paddingVertical: 16 },
  insightBox: { flex: 1, alignItems: 'center' },
  insightDivider: { width: 1, backgroundColor: '#eee' },
  insightValue: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  insightLabel: { fontSize: 12, color: '#888' },
  card: { margin: 16, marginBottom: 0, borderRadius: 20, padding: 20 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 20 },
  subCardLabel: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoIcon: { fontSize: 22, marginRight: 12 },
  infoLabel: { fontSize: 12, color: '#999' },
  infoValue: { fontSize: 16, color: '#222', fontWeight: '500' },
  readonlyBadge: { backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  readonlyText: { fontSize: 11, color: '#00C853', fontWeight: 'bold' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  roleBigCard: { flex: 1, minWidth: '30%', backgroundColor: '#fff', borderRadius: 16, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#eee', elevation: 2 },
  roleCardTitle: { fontSize: 12, fontWeight: '900', color: '#666', marginTop: 5 },
  activeIndicator: { position: 'absolute', top: -10, backgroundColor: '#00C853', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  activeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  checkbox: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#ccc', marginTop: 8, justifyContent: 'center', alignItems: 'center' },
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
  browseSchemesBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 15, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 15, borderWidth: 1, borderColor: '#eee' },
  schemeIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  browseSchemesText: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#333' },
  eligibilityCard: { marginTop: 15, padding: 16, backgroundColor: '#f0f9f1', borderRadius: 15, borderWidth: 1, borderColor: '#C8E6C9' },
  eligibilityTitle: { fontSize: 13, fontWeight: 'bold', color: '#1B5E20', marginBottom: 12 },
  criteriaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  criteriaText: { fontSize: 14, color: '#333', fontWeight: '500' },
  warningBox: { marginTop: 8, padding: 8, backgroundColor: '#FFF3E0', borderRadius: 8 },
  warningText: { fontSize: 11, color: '#E65100', fontWeight: 'bold' },
  timePickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingLeft: 46, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  timeLabel: { fontSize: 12, color: '#999' },
  timeValue: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  clockButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9f1', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, gap: 10, borderWidth: 1, borderColor: '#C8E6C9' },
  clockBtnText: { fontSize: 13, fontWeight: 'bold', color: '#1B5E20' },
});
