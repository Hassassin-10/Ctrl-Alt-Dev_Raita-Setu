import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '@/services/firebase';
import { doc, onSnapshot, setDoc, collection, query, where, orderBy, writeBatch, runTransaction, increment, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { translations } from '@/constants/translations';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthProps {
  user: User | null;
  profile: any | null;
  role: string | null;
  language: string;
  t: any;
  isLoading: boolean;
  notifications: any[];
  unreadCount: number;
  login: (email: string, pass: string) => Promise<any>;
  register: (phone: string, pass: string, roles: string[], fullName: string) => Promise<any>;
  switchRole: (newRole: string) => Promise<void>;
  logout: () => Promise<void>;
  setLanguage: (lang: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
}

const AuthContext = createContext<AuthProps>({} as AuthProps);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [storedLanguage, setStoredLanguage] = useState<string>('English');

  useEffect(() => {
    // Load stored language preference immediately
    const loadStoredLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('@user_language');
        if (savedLang) {
          setStoredLanguage(savedLang);
        }
      } catch (e) {
        console.warn("Failed to load language from storage");
      }
    };
    loadStoredLanguage();

    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeNotes: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (usr) => {
      // Unsubscribe from previous listeners if they exist
      if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
      if (unsubscribeNotes) { unsubscribeNotes(); unsubscribeNotes = null; }

      setUser(usr);
      
      if (usr) {
        // 1. Fetch user profile from unified 'users' collection
        unsubscribeProfile = onSnapshot(doc(db, 'users', usr.uid), (snap) => {
          if (snap.exists()) {
             const data = snap.data();
             setProfile(data);
             if (data.language) setStoredLanguage(data.language);
          } else {
             // Fallback to legacy 'farmers' collection for migration support
             onSnapshot(doc(db, 'farmers', usr.uid), (oldSnap) => {
                if (oldSnap.exists()) {
                  const oldData = oldSnap.data();
                  setProfile(oldData);
                  if (oldData.language) setStoredLanguage(oldData.language);
                }
             });
          }
          setIsLoading(false);
        }, (error) => {
          console.warn("Profile listener error:", error.message);
          setIsLoading(false);
        });

        // 2. Fetch Notifications
        const q = query(collection(db, 'notifications'), where('userId', '==', usr.uid));
        unsubscribeNotes = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
          const notes = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
          // Manually sort in memory to avoid the 'Index Required' error
          const sortedNotes = notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          console.log(`[Sync] Found ${sortedNotes.length} notifications`);
          setNotifications(sortedNotes);
          setUnreadCount(sortedNotes.filter((n: any) => !n.read).length);
        }, (error) => {
          console.warn("Notification listener error:", error.message);
        });

      } else {
        setProfile(null);
        setNotifications([]);
        setUnreadCount(0);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeNotes) unsubscribeNotes();
    };
  }, []);

  const phoneToEmail = (phone: string) => {
    // Basic cleanup
    const cleanPhone = phone.replace(/\s/g, '').replace('+', '');
    return `${cleanPhone}@raithasetu.com`;
  };

  const login = (phone: string, pass: string) => {
    const emailStr = phone.includes('@') ? phone : phoneToEmail(phone);
    return signInWithEmailAndPassword(auth, emailStr, pass);
  };
  
  const register = async (phone: string, pass: string, roles: string[], fullName: string) => {
    const emailStr = phone.includes('@') ? phone : phoneToEmail(phone);
    const result = await createUserWithEmailAndPassword(auth, emailStr, pass);
    
    // Generate unique RS-ID using a transaction
    let rsId = "RS1001";
    try {
        await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(doc(db, 'metadata', 'counters'));
            let nextId = 1001;
            if (counterDoc.exists()) {
                nextId = counterDoc.data().lastUserId + 1;
            }
            rsId = `RS${nextId}`;
            transaction.set(doc(db, 'metadata', 'counters'), { lastUserId: nextId }, { merge: true });
        });
    } catch (e) {
        console.warn("Counter transaction failed, using default ID", e);
    }

    const userData = {
      id: rsId,
      fullName: fullName,
      phone: phone,
      email: emailStr,
      roles: roles,
      activeRole: roles[0],
      uid: result.user.uid,
      createdAt: new Date().toISOString(),
      language: storedLanguage // Use current set language during registration
    };

    await setDoc(doc(db, 'users', result.user.uid), userData);
    
    // Also create the specific role profile (e.g., farmer_profiles)
    if (roles.includes('Farmer')) {
        await setDoc(doc(db, 'farmer_profiles', result.user.uid), { landSize: 0, crops: [] });
    }
    
    return result;
  };

  const switchRole = async (newRole: string) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), { 
      activeRole: newRole,
      role: newRole // Update both to ensure all logic blocks react correctly
    }, { merge: true });
  };

  const logout = () => signOut(auth);

  const setLanguage = async (newLang: string) => {
    setStoredLanguage(newLang);
    await AsyncStorage.setItem('@user_language', newLang);
    if (user) {
      await setDoc(doc(db, 'users', user.uid), { language: newLang }, { merge: true });
    }
  };

  const clearNotifications = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const language = storedLanguage;
  const t = translations[language as keyof typeof translations] || translations.English;
  const role = profile?.activeRole || profile?.role || null;

  return (
    <AuthContext.Provider value={{ 
      user, profile, role, language, t, isLoading, 
      notifications, unreadCount,
      login, register, switchRole, logout, setLanguage, clearNotifications 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
