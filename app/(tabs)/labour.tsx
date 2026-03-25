import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { db } from '@/services/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Pressable,
  Linking
} from 'react-native';
import { BlurView } from 'expo-blur';
import { IconSymbol } from '@/components/ui/icon-symbol';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

type JobStatus = 'Open' | 'Accepted' | 'Completed';
interface Job {
  id: string;
  farmerId: string;
  location: { lat: number, lng: number, name: string };
  workType: string;
  workersNeeded: number;
  maleNeeded: number;
  femaleNeeded: number;
  maleApplied: number;
  femaleApplied: number;
  wage: number;
  date: string;
  description: string;
  status: JobStatus;
  applicantIds: string[];
  createdAt: any;
}

interface LabourProfile {
  uid: string;
  name: string;
  mobile: string;
  location: { lat: number, lng: number, name: string };
  skills: string[];
  availability: 'Available' | 'Busy';
  availableFrom?: string;
  availableUntil?: string;
  gender?: 'Male' | 'Female' | 'Prefer not to say';
  updatedAt: any;
}

const AVAILABLE_SKILLS = ['Harvesting', 'Sowing', 'Weeding', 'Tilling', 'Pesticides', 'Pruning'];

function formatPhone(phone: string) {
  if (!phone) return 'N/A';
  // Remove anything from @ onwards and keep only valid phone chars
  return phone.split('@')[0].trim();
}

function DetailRow({ label, value, icon }: { label: string, value: string, icon: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailIcon}>{icon}</Text>
      <View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function LabourHub() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const { user, role, profile, t } = useAuth();

  const [viewMode, setViewMode] = useState<'hub' | 'action' | 'profile'>(role === 'Farmer' ? 'action' : 'hub');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<LabourProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<LabourProfile | null>(null);

  // Labour Profile State
  const [labourName, setLabourName] = useState('');
  const [labourPhone, setLabourPhone] = useState('');
  const [labourSkills, setLabourSkills] = useState<string[]>([]);
  const [labourAvailability, setLabourAvailability] = useState<'Available' | 'Busy'>('Available');
  const [labourGender, setLabourGender] = useState<'Male' | 'Female' | 'Prefer not to say' | undefined>(undefined);
  const [availableFrom, setAvailableFrom] = useState(new Date());
  const [availableUntil, setAvailableUntil] = useState(new Date(Date.now() + 86400000 * 7)); // Default 1 week
  const [showPicker, setShowPicker] = useState<'from' | 'until' | null>(null);

  // Post Job Form State
  const [workType, setWorkType] = useState('Sowing');
  const [maleNeeded, setMaleNeeded] = useState('0');
  const [femaleNeeded, setFemaleNeeded] = useState('0');
  const [wage, setWage] = useState('400');
  const [description, setDescription] = useState('');
  const [jobDate, setJobDate] = useState(new Date());
  const [showJobDatePicker, setShowJobDatePicker] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<LabourProfile | null>(null);
  const [showWorkerProfile, setShowWorkerProfile] = useState(false);

  // Shakti Shield Safety Modal State
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [showLegalAlert, setShowLegalAlert] = useState(false);
  const [pendingHireWorker, setPendingHireWorker] = useState<LabourProfile | null>(null);

  useEffect(() => {
    setViewMode(role === 'Farmer' ? 'action' : 'hub');
  }, [role]);

  useEffect(() => {
    if (!user) return;

    const jobsRef = collection(db, 'jobs');
    const qJobs = query(jobsRef, orderBy('createdAt', 'desc'));
    const unsubJobs = onSnapshot(qJobs, (snapshot) => {
      setJobs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Job)));
      if (role === 'Labour') setIsLoading(false);
    }, (error) => {
      console.warn("Jobs listener error:", error.message);
      if (role === 'Labour') setIsLoading(false);
    });

    if (role === 'Farmer') {
      const workersRef = collection(db, 'labourProfiles');
      const unsubWorkers = onSnapshot(workersRef, (snapshot) => {
        setWorkers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as LabourProfile)));
        setIsLoading(false);
      }, (error) => {
        console.warn("Workers listener error:", error.message);
        setIsLoading(false);
      });
      return () => { unsubJobs(); unsubWorkers(); };
    }

    if (role === 'Labour') {
      const loadProfile = async () => {
        const pDoc = await getDoc(doc(db, 'labourProfiles', user.uid));
        if (pDoc.exists()) {
          const data = pDoc.data() as LabourProfile;
          setCurrentProfile(data);
          setLabourName(data.name || '');
          setLabourPhone(data.mobile || '');
          setLabourSkills(data.skills || []);
          setLabourAvailability(data.availability || 'Available');
          setLabourGender(data.gender);
          if (data.availableFrom) setAvailableFrom(new Date(data.availableFrom));
          if (data.availableUntil) setAvailableUntil(new Date(data.availableUntil));
        }
      };
      loadProfile();
    }

    return () => unsubJobs();
  }, [user, role]);

  const toggleSkill = (skill: string) => {
    setLabourSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handlePostJob = async () => {
    if (!user) return;
    const m = parseInt(maleNeeded || '0');
    const f = parseInt(femaleNeeded || '0');
    if (m + f === 0) {
      Alert.alert('Invalid Count', 'Please specify number of male or female workers needed.');
      return;
    }

    setIsPosting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const location = status === 'granted' ? await Location.getCurrentPositionAsync({}) : null;

      await addDoc(collection(db, 'jobs'), {
        farmerId: user.uid,
        location: { lat: location?.coords.latitude || 0, lng: location?.coords.longitude || 0, name: "Local Farm" },
        workType,
        workersNeeded: m + f,
        maleNeeded: m,
        femaleNeeded: f,
        maleApplied: 0,
        femaleApplied: 0,
        wage: parseInt(wage),
        date: new Date().toLocaleDateString(),
        description,
        status: 'Open',
        applicantIds: [],
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success!', 'Job posted successfully.');
      setViewMode('hub');
      setDescription('');
      setMaleNeeded('0');
      setFemaleNeeded('0');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsPosting(false);
    }
  };

  const handleSaveLabourProfile = async () => {
    if (!user) return;
    if (!labourGender) {
      Alert.alert('Gender Selection Mandatory', 'For your safety and to enable dedicated security features (Shakti Shield), choosing a gender is mandatory. Your choice helps local authorities provide better protection.');
      return;
    }
    setIsSavingProfile(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const location = status === 'granted' ? await Location.getCurrentPositionAsync({}) : null;
      const profileData: LabourProfile = {
        uid: user.uid,
        name: labourName || profile?.displayName || 'Worker',
        mobile: formatPhone(labourPhone),
        location: { lat: location?.coords.latitude || 0, lng: location?.coords.longitude || 0, name: "User Location" },
        skills: labourSkills,
        availability: labourAvailability,
        availableFrom: availableFrom.toISOString(),
        availableUntil: availableUntil.toISOString(),
        gender: labourGender,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'labourProfiles', user.uid), profileData, { merge: true });
      setCurrentProfile(profileData);
      Alert.alert('Profile Saved', 'Your professional profile is updated.');
      setViewMode('hub');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const acceptJob = async (job: Job) => {
    if (!user || !currentProfile) {
      Alert.alert('Profile Incomplete', 'Please complete your labour profile first.');
      setViewMode('profile');
      return;
    }

    const gender = currentProfile.gender;
    if (!gender || gender === 'Prefer not to say') {
      Alert.alert('Gender Required', 'Please update your gender in profile to apply for this role.');
      setViewMode('profile');
      return;
    }

    const applicantIds = job.applicantIds || [];
    if (applicantIds.includes(user.uid)) {
      Alert.alert('Already Applied', 'You have already applied.');
      return;
    }

    // Gender Quota Check
    let canApply = false;
    let updateData: any = {};

    if (gender === 'Male') {
      if ((job.maleApplied || 0) < job.maleNeeded) {
        canApply = true;
        updateData.maleApplied = (job.maleApplied || 0) + 1;
      } else {
        Alert.alert('Quota Full', 'All male positions for this job are already filled.');
        return;
      }
    } else if (gender === 'Female') {
      if ((job.femaleApplied || 0) < job.femaleNeeded) {
        canApply = true;
        updateData.femaleApplied = (job.femaleApplied || 0) + 1;
      } else {
        Alert.alert('Quota Full', 'All female positions for this job are already filled.');
        return;
      }
    }

    if (canApply) {
      try {
        const newApplicants = [...applicantIds, user.uid];
        const isFull = newApplicants.length >= job.workersNeeded;
        updateData.applicantIds = newApplicants;
        updateData.status = isFull ? 'Accepted' : 'Open';

        await updateDoc(doc(db, 'jobs', job.id), updateData);

        // --- Notification Logic ---
        const notificationsRef = collection(db, 'notifications');

        // Notification to Labourer
        await addDoc(notificationsRef, {
          userId: user.uid,
          title: 'Job Joined! 🎉',
          message: `You've joined the ${job.workType} job. Location: ${job.location.name}`,
          type: 'job_match',
          createdAt: new Date().toISOString(),
          read: false
        });

        // Notification to Farmer
        await addDoc(notificationsRef, {
          userId: job.farmerId,
          title: 'New Worker! 👥',
          message: `${currentProfile.name} has joined your ${job.workType} job. Progress: ${newApplicants.length}/${job.workersNeeded}`,
          type: 'worker_joined',
          workerId: user.uid,
          workerPhone: profile?.phone || 'N/A', // Use unified profile phone
          createdAt: new Date().toISOString(),
          read: false
        });

        Alert.alert('Success', 'You have been added to the worker list.');
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }
  };

  const renderJobCard = ({ item }: { item: Job }) => {
    const isMatched = currentProfile?.skills.includes(item.workType);
    const applicantsCount = item.applicantIds?.length || 0;
    const hasApplied = item.applicantIds?.includes(user?.uid || '');

    return (
      <View style={[styles.card, { backgroundColor: '#ffffff' }]}>
        <View style={styles.cardHeader}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}><Text style={styles.badgeText}>{item.workType}</Text></View>
            {isMatched && <View style={[styles.badge, { backgroundColor: '#E3F2FD' }]}><Text style={[styles.badgeText, { color: '#1976D2' }]}>✨ {t.skills} Match</Text></View>}
          </View>
          <Text style={styles.wageText}>₹{item.wage}/day</Text>
        </View>
        <Text style={styles.cardDesc}>{item.description || "Reliable work needed."}</Text>

        <View style={styles.genderBreakdown}>
          <View style={styles.genderBox}>
            <Text style={styles.genderVal}>{item.maleApplied || 0} / {item.maleNeeded || 0}</Text>
            <Text style={styles.genderLab}>{t.male}</Text>
          </View>
          <View style={styles.genderBox}>
            <Text style={styles.genderVal}>{item.femaleApplied || 0} / {item.femaleNeeded || 0}</Text>
            <Text style={styles.genderLab}>{t.female}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>👥 {applicantsCount}/{item.workersNeeded} Total</Text>
          <Text style={styles.footerText}>📍 {item.location.name}</Text>
        </View>

        {item.farmerId !== user?.uid ? (
          hasApplied ? (
            <View style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ccc' }]}>
              <Text style={[styles.actionBtnText, { color: '#999' }]}>✓ Applied</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.actionBtn} onPress={() => acceptJob(item)}>
              <Text style={styles.actionBtnText}>{t.acceptJob}</Text>
            </TouchableOpacity>
          )
        ) : (
          <View style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ccc' }]}>
            <Text style={[styles.actionBtnText, { color: '#666' }]}>{applicantsCount} Applicants</Text>
          </View>
        )}
      </View>
    );
  };

  const hireWorkerDirectly = async (worker: LabourProfile) => {
    if (!user) return;

    if (worker.gender === 'Female') {
      setPendingHireWorker(worker);
      setShowLegalAlert(true);
    } else {
      confirmHiring(worker);
    }
  };

  const confirmHiring = async (worker: LabourProfile) => {
    const target = worker || pendingHireWorker;
    if (!target) return;
    
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: target.uid,
        title: 'Hiring Interest! 👷‍♂️',
        message: `${profile.fullName || 'A Farmer'} is interested in hiring you. Contact them soon!`,
        type: 'worker_hired',
        createdAt: new Date().toISOString(),
        read: false
      });
      Alert.alert('Request Sent', `A notification has been sent to ${target.name}. You can also call them: ${target.mobile || 'No number'}`);
      setShowLegalAlert(false);
      setPendingHireWorker(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const viewWorkerProfile = (worker: LabourProfile) => {
    setSelectedWorker(worker);
    setShowWorkerProfile(true);
  };

  const renderWorkerCard = ({ item }: { item: LabourProfile }) => (
    <TouchableOpacity
      style={styles.premiumCard}
      onPress={() => viewWorkerProfile(item)}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardId}>RS-{item.uid.slice(0, 4).toUpperCase()}</Text>
        <View style={[styles.statusBadge, { backgroundColor: item.availability === 'Available' ? '#E8F5E9' : '#FFF3E0' }]}>
          <Text style={{ fontSize: 13, color: item.availability === 'Available' ? '#2E7D32' : '#EF6C00' }}>
            {item.availability === 'Available' ? '✓ available' : '🕒 busy'}
          </Text>
        </View>
      </View>

      <Text style={styles.premiumName}>{item.name}</Text>

      <View style={styles.contentRow}>
        <Text style={{ fontSize: 18, marginRight: 8 }}>📦</Text>
        <Text style={styles.contentText}>{item.skills[0] || 'General'}  •  {item.gender}</Text>
      </View>

      <View style={styles.locationWrapper}>
        <View style={styles.locationItem}>
          <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.locationText}>{item.location.name}</Text>
        </View>
        <View style={styles.locationItem}>
          <View style={[styles.dot, { backgroundColor: '#F44336' }]} />
          <Text style={styles.locationText}>Verified Service Area</Text>
        </View>
      </View>

      <View style={styles.cardSeparator} />

      <View style={styles.cardBottom}>
        <View style={styles.dateInfo}>
          <Text style={{ fontSize: 13, color: '#888' }}>📅 {item.availableFrom ? new Date(item.availableFrom).toLocaleDateString() : 'N/A'} - {item.availableUntil ? new Date(item.availableUntil).toLocaleDateString() : 'N/A'}</Text>
        </View>
        <TouchableOpacity
          style={styles.callActionButton}
          onPress={() => Linking.openURL(`tel:${formatPhone(item.mobile)}`)}
        >
          <IconSymbol name="phone.fill" size={18} color="#333" />
          <Text style={styles.callNumberText}>{formatPhone(item.mobile)}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const [genderFilter, setGenderFilter] = useState<string | null>(null);
  const getFilteredWorkers = () => {
    let list = [...workers];
    if (genderFilter) list = list.filter(w => w.gender === genderFilter);
    return list.sort((a, b) => (a.availability === 'Available' ? -1 : 1));
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <LinearGradient colors={['#00C853', '#1B5E20']} style={styles.header}>
        <Text style={styles.title}>👷‍♂️ {t.labourHub}</Text>
        <View style={styles.tabBar}>
          {role === 'Labour' ? (
            <>
              <TouchableOpacity style={[styles.tab, viewMode === 'hub' && styles.activeTab]} onPress={() => setViewMode('hub')}>
                <Text style={[styles.tabText, viewMode === 'hub' && styles.activeTabText]}>{t.findWork}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, viewMode === 'profile' && styles.activeTab]} onPress={() => setViewMode('profile')}>
                <Text style={[styles.tabText, viewMode === 'profile' && styles.activeTabText]}>{t.profile}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.tab, viewMode === 'hub' && styles.activeTab]} onPress={() => setViewMode('hub')}>
                <Text style={[styles.tabText, viewMode === 'hub' && styles.activeTabText]}>Workers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, viewMode === 'action' && styles.activeTab]} onPress={() => setViewMode('action')}>
                <Text style={[styles.tabText, viewMode === 'action' && styles.activeTabText]}>{t.postJob}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {role === 'Farmer' && viewMode === 'hub' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
            <TouchableOpacity style={[styles.filterBtn, !genderFilter && styles.filterBtnActive]} onPress={() => setGenderFilter(null)}>
              <Text style={[styles.filterText, !genderFilter && { color: '#fff' }]}>All</Text>
            </TouchableOpacity>
            {['Male', 'Female'].map(g => (
              <TouchableOpacity key={g} style={[styles.filterBtn, genderFilter === g && styles.filterBtnActive]} onPress={() => setGenderFilter(g)}>
                <Text style={[styles.filterText, genderFilter === g && { color: '#fff' }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </LinearGradient>

      {viewMode === 'hub' ? (
        isLoading ? (<ActivityIndicator style={{ marginTop: 50 }} color={c.primary} />) : (
          <FlatList
            data={role === 'Labour' ? jobs : getFilteredWorkers()}
            renderItem={role === 'Labour' ? (renderJobCard as any) : (renderWorkerCard as any)}
            keyExtractor={(item: any) => item.id || item.uid}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>{role === 'Labour' ? t.noJobs : 'No workers found.'}</Text>}
          />
        )
      ) : viewMode === 'action' ? (
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.label}>{t.typeOfWork}</Text>
          <View style={styles.row}>{['Sowing', 'Harvesting', 'Weeding'].map(t => (<TouchableOpacity key={t} style={[styles.chip, workType === t && { backgroundColor: c.primary }]} onPress={() => setWorkType(t)}><Text style={[styles.chipText, workType === t && { color: '#fff' }]}>{t}</Text></TouchableOpacity>))}</View>
          <View style={[styles.row, { marginTop: 15 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t.maleWorkers}</Text>
              <TextInput style={styles.input} value={maleNeeded} onChangeText={setMaleNeeded} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t.femaleWorkers}</Text>
              <TextInput style={styles.input} value={femaleNeeded} onChangeText={setFemaleNeeded} keyboardType="numeric" />
            </View>
          </View>
          <Text style={styles.label}>{t.wagePerWorker}</Text>
          <TextInput style={styles.input} value={wage} onChangeText={setWage} keyboardType="numeric" />

          <Text style={styles.label}>Job Date</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowJobDatePicker(true)}>
            <Text>{jobDate.toLocaleDateString()}</Text>
          </TouchableOpacity>

          {showJobDatePicker && (
            <DateTimePicker
              value={jobDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowJobDatePicker(false);
                if (event.type === 'set' && date) setJobDate(date);
              }}
            />
          )}

          <Text style={styles.label}>{t.description}</Text>
          <TextInput style={[styles.input, { height: 80 }]} value={description} onChangeText={setDescription} multiline />
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: c.primary }]} onPress={handlePostJob}>
            <Text style={styles.primaryBtnText}>{t.postJob}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={labourName} onChangeText={setLabourName} placeholder="Your name" />
          
          <Text style={styles.label}>Phone Number</Text>
          <TextInput style={styles.input} value={labourPhone} onChangeText={setLabourPhone} placeholder="e.g. 9876543210" keyboardType="phone-pad" maxLength={10} />
          <Text style={styles.label}>{t.gender}</Text>
          <View style={styles.row}>
            {['Male', 'Female'].map((g: any) => (
              <TouchableOpacity 
                key={g} 
                style={[styles.chip, labourGender === g && { backgroundColor: c.primary }]} 
                onPress={() => {
                  setLabourGender(g);
                  if (g === 'Female') {
                    Alert.alert(
                      "🛡️ Shakti Safety Enabled",
                      "You have selected Female. Raita Setu provides special safety features like the Shakti SOS Shield, Emergency Helpline, and location tracking for your security."
                    );
                  }
                }}
              >
                <Text style={[styles.chipText, labourGender === g && { color: '#fff' }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>{t.availability}</Text>
          <View style={styles.row}>{['Available', 'Busy'].map((a: any) => (<TouchableOpacity key={a} style={[styles.chip, labourAvailability === a && { backgroundColor: c.primary }]} onPress={() => setLabourAvailability(a)}><Text style={[styles.chipText, labourAvailability === a && { color: '#fff' }]}>{a}</Text></TouchableOpacity>))}</View>
          <Text style={styles.label}>My Skills</Text>
          <View style={styles.row}>{AVAILABLE_SKILLS.map(s => (<TouchableOpacity key={s} style={[styles.chip, labourSkills.includes(s) && { backgroundColor: '#64B5F6', borderColor: '#64B5F6' }]} onPress={() => toggleSkill(s)}><Text style={[styles.chipText, labourSkills.includes(s) && { color: '#fff' }]}>{s}</Text></TouchableOpacity>))}</View>

          <Text style={styles.label}>Availability Period</Text>
          <View style={styles.datePickerRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker('from')}>
              <Text style={styles.dateBtnLab}>From</Text>
              <Text style={styles.dateBtnVal}>{availableFrom.toLocaleDateString()}</Text>
            </TouchableOpacity>
            <View style={styles.dateSep} />
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker('until')}>
              <Text style={styles.dateBtnLab}>Until</Text>
              <Text style={styles.dateBtnVal}>{availableUntil.toLocaleDateString()}</Text>
            </TouchableOpacity>
          </View>

          {showPicker && (
            <DateTimePicker
              value={showPicker === 'from' ? availableFrom : availableUntil}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event: DateTimePickerEvent, date?: Date) => {
                setShowPicker(null);
                if (event.type === 'set' && date) {
                  if (showPicker === 'from') setAvailableFrom(date);
                  else setAvailableUntil(date);
                }
              }}
            />
          )}

          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: c.primary }]} onPress={handleSaveLabourProfile} disabled={isSavingProfile}>
            {isSavingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t.saveProfile}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Shakti Safety Shield FAB (Only for Female workers) */}
      {profile?.gender === 'Female' && (
        <TouchableOpacity 
          style={styles.safetyFab} 
          onPress={() => setSafetyModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.safetyFabInner}>
            <IconSymbol name="shield.fill" size={28} color="#fff" />
            <Text style={styles.safetyFabText}>SHAKTI</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Shakti Safety Shield Modal */}
      <Modal visible={safetyModalVisible} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setSafetyModalVisible(false)}>
          <View style={[styles.safetyModalSheet, { backgroundColor: '#fff' }]}>
            <View style={styles.safetyHeader}>
              <View style={styles.safetyHeaderRow}>
                <IconSymbol name="shield.fill" size={32} color="#D32F2F" />
                <Text style={styles.safetyTitle}>Shakti Safety Shield</Text>
              </View>
              <TouchableOpacity onPress={() => setSafetyModalVisible(false)}>
                <IconSymbol name="xmark.circle.fill" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.sosSection}>
                <TouchableOpacity 
                  style={[styles.sosButton, isSOSActive && styles.sosButtonActive]}
                  onLongPress={() => {
                    setIsSOSActive(true);
                    Linking.openURL('tel:112');
                    Alert.alert("SOS Triggered", "Emergency services have been contacted.");
                  }}
                  delayLongPress={2000}
                >
                  <Text style={styles.sosIcon}>🚨</Text>
                  <Text style={styles.sosText}>Long Press (2s) for SOS</Text>
                </TouchableOpacity>
                <Text style={styles.sosSub}>Hold to call 112 & Notify trusted contacts</Text>
              </View>

              <View style={styles.safetyToolsRow}>
                <TouchableOpacity style={styles.toolCard} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${profile?.location?.lat},${profile?.location?.lng}`)}>
                  <IconSymbol name="location.fill" size={24} color="#1976D2" />
                  <Text style={styles.toolText}>Share Location</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolCard} onPress={() => Linking.openURL('tel:919380596236')}>
                  <IconSymbol name="phone.fill" size={24} color="#2E7D32" />
                  <Text style={styles.toolText}>Women Helpline</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.safetyCard, { backgroundColor: '#E3F2FD' }]}>
                <Text style={styles.safetyCardTitle}>👩‍🌾 Today's Safety Tip</Text>
                <Text style={styles.safetyCardMsg}>"Always work in groups and inform a family member before starting work at a new location."</Text>
              </View>

              <View style={styles.protocolList}>
                <Text style={styles.protocolHeader}>Work Safety Protocols</Text>
                <View style={styles.protocolItem}><Text style={styles.dot}>•</Text><Text style={styles.protocolDesc}>Verified Farmer Badge: Check before starting.</Text></View>
                <View style={styles.protocolItem}><Text style={styles.dot}>•</Text><Text style={styles.protocolDesc}>Safe Transport: Use system vehicles when possible.</Text></View>
                <View style={styles.protocolItem}><Text style={styles.dot}>•</Text><Text style={styles.protocolDesc}>Check-in: log your entry on arrival.</Text></View>
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Police / Legal Alert Modal for Farmers */}
      <Modal visible={showLegalAlert} animationType="fade" transparent>
        <View style={styles.legalModalOverlay}>
          <View style={styles.legalContent}>
            <LinearGradient colors={['#D32F2F', '#B71C1C']} style={styles.legalHeader}>
              <IconSymbol name="shield.fill" size={40} color="#fff" />
              <Text style={styles.legalHeaderTitle}>POLICE / LEGAL ALERT</Text>
            </LinearGradient>
            
            <View style={styles.legalBody}>
              <Text style={styles.legalWarning}>⚠️ RESPONSIBILITY NOTICE</Text>
              <Text style={styles.legalText}>
                You are proceeding to hire a <Text style={{fontWeight: 'bold'}}>Female worker</Text>. 
                Any form of harassment, misconduct, or unsafe behavior is a <Text style={{color: '#D32F2F', fontWeight: 'bold'}}>CRIMINAL OFFENSE</Text>.
              </Text>
              
              <View style={styles.trackingNotice}>
                <IconSymbol name="location.fill" size={16} color="#D32F2F" />
                <Text style={styles.trackingText}>
                  Your mobile number, live location, and session activity are strictly tracked. 
                  Misconduct will be reported to authorities (112) automatically.
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.legalAgreeBtn} 
                onPress={() => pendingHireWorker && confirmHiring(pendingHireWorker)}
              >
                <Text style={styles.legalAgreeText}>I AGREE & UNDERSTAND</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.legalCancelBtn} onPress={() => { setShowLegalAlert(false); setPendingHireWorker(null); }}>
                <Text style={styles.legalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Worker Profile Modal */}
      <Modal visible={showWorkerProfile} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowWorkerProfile(false)}>
          <BlurView intensity={90} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Worker Profile</Text>
              <TouchableOpacity onPress={() => setShowWorkerProfile(false)}>
                <IconSymbol name="xmark.circle.fill" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedWorker && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.profileHero}>
                  <View style={styles.bigAvatar}>
                    <Text style={styles.bigAvatarText}>{selectedWorker.name.charAt(0)}</Text>
                  </View>
                  <Text style={styles.heroName}>{selectedWorker.name}</Text>
                  <Text style={styles.heroId}>🪪 RS-{selectedWorker.uid.slice(0, 5).toUpperCase()}</Text>
                </View>

                <View style={styles.detailSection}>
                  <DetailRow label="Gender" value={selectedWorker.gender || 'N/A'} icon="👤" />
                  <DetailRow label="Location" value={selectedWorker.location.name} icon="📍" />
                  <DetailRow label="Availability" value={selectedWorker.availability} icon="📅" />
                  {selectedWorker.availableFrom && (
                    <DetailRow
                      label="Available Range"
                      value={`${new Date(selectedWorker.availableFrom).toLocaleDateString()} to ${new Date(selectedWorker.availableUntil || '').toLocaleDateString()}`}
                      icon="⏳"
                    />
                  )}
                  <DetailRow label="Contact" value={formatPhone(selectedWorker.mobile)} icon="📱" />
                </View>

                <Text style={[styles.label, { paddingHorizontal: 0 }]}>Skills & Expertise</Text>
                <View style={styles.row}>
                  {selectedWorker.skills?.map(s => (
                    <View key={s} style={[styles.skillTag, { paddingVertical: 10, paddingHorizontal: 15 }]}>
                      <Text style={styles.skillTagText}>{s}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: c.primary, marginTop: 40 }]}
                  onPress={() => {
                    setShowWorkerProfile(false);
                    hireWorkerDirectly(selectedWorker);
                  }}
                >
                  <Text style={styles.primaryBtnText}>Hire & Call Now</Text>
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
  header: { padding: 25, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 15, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  activeTab: { backgroundColor: '#fff' },
  tabText: { color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' },
  activeTabText: { color: '#00C853' },
  filterBar: { flexDirection: 'row', marginTop: 15, paddingBottom: 5 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  filterBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  filterText: { fontSize: 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' },
  list: { padding: 20 },
  card: { padding: 22, borderRadius: 20, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, borderWidth: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#2E7D32', fontSize: 12, fontWeight: 'bold' },
  wageText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  cardDesc: { fontSize: 15, color: '#555', marginBottom: 15 },
  genderBreakdown: { flexDirection: 'row', gap: 10, marginBottom: 15, backgroundColor: 'transparent', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  genderBox: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#eee' },
  genderVal: { fontSize: 18, fontWeight: 'bold', color: '#00C853' },
  genderLab: { fontSize: 11, color: '#888', fontWeight: 'bold' },
  cardFooter: { flexDirection: 'row', gap: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
  footerText: { fontSize: 12, color: '#888' },
  actionBtn: { backgroundColor: '#00C853', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  actionBtnText: { color: '#fff', fontWeight: 'bold' },
  workerName: { fontSize: 18, fontWeight: '800', color: '#111' },
  availBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  workerMeta: { fontSize: 13, color: '#666', marginTop: 2, marginBottom: 10 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillTag: { backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  skillTagText: { color: '#1976D2', fontSize: 11, fontWeight: 'bold' },
  form: { padding: 25 },
  label: { fontSize: 14, fontWeight: '700', color: '#444', marginTop: 15, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#bbb' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  input: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1, borderColor: '#bbb' },
  primaryBtn: { marginTop: 30, paddingVertical: 18, borderRadius: 15, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 50, color: '#999', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { width: '100%', height: '85%', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#111' },
  profileHero: { alignItems: 'center', marginBottom: 30 },
  bigAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 4, borderColor: '#fff' },
  bigAvatarText: { fontSize: 40, fontWeight: 'bold', color: '#00C853' },
  heroName: { fontSize: 28, fontWeight: '900', color: '#111' },
  heroId: { fontSize: 14, color: '#666', marginTop: 4, backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  detailSection: { backgroundColor: '#f9f9f9', borderRadius: 20, padding: 20, marginBottom: 25 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  detailIcon: { fontSize: 22, marginRight: 15 },
  detailLabel: { fontSize: 12, color: '#888', fontWeight: 'bold' },
  detailValue: { fontSize: 16, color: '#111', fontWeight: 'bold' },
  premiumCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 25, marginBottom: 20, borderWidth: 0, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardId: { color: '#888', letterSpacing: 1, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20 },
  premiumName: { fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 15 },
  contentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  contentText: { fontSize: 18, color: '#444' },
  locationWrapper: { gap: 10, marginBottom: 20 },
  locationItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  locationText: { color: '#666', fontSize: 16 },
  cardSeparator: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 20 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { color: '#888', fontSize: 15 },
  callActionButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'transparent', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: '#bbb' },
  callNumberText: { fontSize: 14, fontWeight: 'bold', color: '#111' },
  datePickerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#bbb' },
  dateBtn: { flex: 1, alignItems: 'center' },
  dateBtnLab: { fontSize: 11, color: '#888', fontWeight: 'bold', marginBottom: 4 },
  dateBtnVal: { fontSize: 15, fontWeight: '700', color: '#111' },
  dateSep: { width: 1, height: 30, backgroundColor: '#aaa', marginHorizontal: 10 },
  
  safetyFab: { position: 'absolute', bottom: 30, right: 30, zIndex: 1000 },
  safetyFabInner: { backgroundColor: '#D32F2F', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 30, flexDirection: 'row', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  safetyFabText: { color: '#fff', fontWeight: '900', marginLeft: 8, fontSize: 12, letterSpacing: 1 },
  safetyModalSheet: { width: '100%', height: '70%', backgroundColor: '#fff', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, position: 'absolute', bottom: 0 },
  safetyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  safetyHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  safetyTitle: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  sosSection: { alignItems: 'center', marginBottom: 25 },
  sosButton: { width: width * 0.7, height: 80, backgroundColor: '#FFEBEE', borderRadius: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFCDD2', borderStyle: 'dashed' },
  sosButtonActive: { backgroundColor: '#D32F2F', borderColor: '#D32F2F' },
  sosIcon: { fontSize: 32, marginBottom: 4 },
  sosText: { fontSize: 16, fontWeight: 'bold', color: '#D32F2F' },
  sosSub: { fontSize: 12, color: '#666', marginTop: 10, textAlign: 'center' },
  safetyToolsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, marginBottom: 25 },
  toolCard: { flex: 1, backgroundColor: '#F5F5F5', padding: 20, borderRadius: 20, alignItems: 'center', gap: 8 },
  toolText: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  safetyCard: { padding: 20, borderRadius: 25, marginBottom: 25 },
  safetyCardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1B5E20', marginBottom: 5 },
  safetyCardMsg: { fontSize: 14, color: '#444', lineHeight: 22 },
  protocolList: { marginBottom: 30 },
  protocolHeader: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 15 },
  protocolItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  protocolDesc: { fontSize: 14, color: '#555', flex: 1, lineHeight: 20 },
  legalModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  legalContent: { width: '100%', backgroundColor: '#fff', borderRadius: 25, overflow: 'hidden' },
  legalHeader: { padding: 25, alignItems: 'center', gap: 10 },
  legalHeaderTitle: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  legalBody: { padding: 25 },
  legalWarning: { color: '#D32F2F', fontWeight: 'bold', fontSize: 14, textAlign: 'center', marginBottom: 15 },
  legalText: { fontSize: 16, lineHeight: 24, textAlign: 'center', color: '#333', marginBottom: 20 },
  trackingNotice: { backgroundColor: '#FFEBEE', padding: 15, borderRadius: 15, flexDirection: 'row', gap: 10, marginBottom: 25 },
  trackingText: { flex: 1, fontSize: 12, color: '#B71C1C', lineHeight: 18, fontWeight: 'bold' },
  legalAgreeBtn: { backgroundColor: '#1B5E20', padding: 18, borderRadius: 15, alignItems: 'center', marginBottom: 12 },
  legalAgreeText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  legalCancelBtn: { padding: 10, alignItems: 'center' },
  legalCancelText: { color: '#666', fontSize: 14 },
});
