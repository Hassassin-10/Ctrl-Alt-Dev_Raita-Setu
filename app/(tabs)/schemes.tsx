import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAuth } from '@/context/AuthContext';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || '');

interface Scheme {
  title: string;
  desc: string;
  eligible: boolean;
  applyLink?: string;
}

export default function SchemesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useAuth();

  useEffect(() => {
    fetchSchemesFromAI();
  }, [language]); // Refresh when language changes

  const DEFAULT_SCHEMES: Scheme[] = [
    { 
      title: "PM-KISAN", 
      desc: language === 'Kannada' ? "ಪ್ರತಿ ವರ್ಷ ₹6,000 ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ಜಮೆಯಾಗುತ್ತದೆ." : "Get ₹6,000 yearly in your bank account for farming needs.", 
      eligible: true,
      applyLink: "https://pmkisan.gov.in/RegistrationFormNew.aspx"
    },
    { 
      title: language === 'Kannada' ? "ಕಿಸಾನ್ ಕ್ರೆಡಿಟ್ ಕಾರ್ಡ್ (KCC)" : "Kisan Credit Card (KCC)", 
      desc: language === 'Kannada' ? "ಬೀಜಗಳು ಮತ್ತು ರಸಗೊಬ್ಬರಗಳಿಗಾಗಿ ಕಡಿಮೆ ಬಡ್ಡಿಯ ಸಾಲ." : "Low-interest loans for seeds, fertilizers, and equipment.", 
      eligible: true,
      applyLink: "https://www.myscheme.gov.in/schemes/kcc"
    },
    { 
      title: language === 'Kannada' ? "ಫಸಲ್ ಭೀಮಾ ಯೋಜನೆ" : "Fasal Bima Yojana", 
      desc: language === 'Kannada' ? "ಬೆಳೆ ನಾಶವಾದರೆ ಸಮಗ್ರ ವಿಮೆ ರಕ್ಷಣೆ." : "Comprehensive insurance cover against crop failure.", 
      eligible: true,
      applyLink: "https://pmfby.gov.in/"
    },
    { 
      title: language === 'Kannada' ? "ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಕಾರ್ಡ್" : "Soil Health Card", 
      desc: language === 'Kannada' ? "ನಿಮ್ಮ ಮಣ್ಣಿನ ಪೋಷಕಾಂಶಗಳ ಬಗ್ಗೆ ವೈಜ್ಞಾನಿಕ ಶಿಫಾರಸುಗಳನ್ನು ಪಡೆಯಿರಿ." : "Get scientific recommendations for your soil nutrients.", 
      eligible: true,
      applyLink: "https://www.soilhealth.dac.gov.in/"
    },
    { 
      title: language === 'Kannada' ? "ಪರಂಪರಾಗತ ಕೃಷಿ ವಿಕಾಸ ಯೋಜನೆ" : "Paramparagat Krishi", 
      desc: language === 'Kannada' ? "ಸಾವಯವ ಕೃಷಿಗಾಗಿ ಆರ್ಥಿಕ ನೆರವು." : "Financial support for certified organic farming clusters.", 
      eligible: true,
      applyLink: "https://pgsindia-ncof.dac.gov.in/pkvy/index.aspx"
    },
  ];

  const fetchSchemesFromAI = async () => {
    try {
      if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
         setSchemes(DEFAULT_SCHEMES);
         setLoading(false);
         return;
      }
      
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      const prompt = `Return a strict JSON array containing exactly 5 real Indian agricultural government schemes tailored for a small-scale farmer. 
      Important: Return the 'title' and 'desc' in ${language} because the user is using the app in ${language}.
      Use exactly this JSON structure and nothing else:
      [
        { "title": "Scheme Name", "desc": "1 sentence easy explanation", "eligible": true, "applyLink": "official_gov_url" }
      ]`;
      
      const result = await model.generateContent(prompt);
      let text = result.response.text();
      
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) {
         throw new Error("Invalid AI format");
      }
      
      const parsedSchemes = JSON.parse(match[0]);
      setSchemes(parsedSchemes);
    } catch (error: any) {
      setSchemes(DEFAULT_SCHEMES);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { backgroundColor: c.primary }]}>
        <Text style={[styles.title, { color: '#FAFAFA' }]}>{t.schemes}</Text>
        <Text style={[styles.subtitle, { color: '#FAFAFA' }]}>AI Explained & Eligibility Checked</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
            <View style={{ marginTop: 100, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={c.primary} />
                <Text style={{ marginTop: 20, color: '#666', fontSize: 16, fontWeight: '500' }}>{t.scanningPortals}</Text>
            </View>
        ) : (
            schemes.map((scheme, index) => (
              <SchemeCard 
                key={index} 
                scheme={scheme}
                color={c.surface} 
                textColor={c.text} 
                primary={c.primary}
                t={t}
              />
            ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function SchemeCard({ scheme, color, textColor, primary, t }: any) {
  const [loading, setLoading] = useState(false);
  const { title, desc, eligible, applyLink } = scheme;

  const askGemini = async () => {
    setLoading(true);
    try {
      if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
         Alert.alert(`🚜 ${title}`, `${desc}`);
         return;
      }
      
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `You are "Raitha Setu AI". Explain "${title}" in 3 very short bullet points for an Indian farmer. Respond in ${t.language || 'English'}.`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      const cleanText = response.text().replace(/\*/g, '');
      Alert.alert(`🚜 ${title}`, cleanText);

    } catch (error: any) {
      Alert.alert(`🚜 ${title}`, desc);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!applyLink) {
      Alert.alert(t.comingSoon || "Coming Soon", t.applySoon || "Application will open soon.");
      return;
    }
    Linking.openURL(applyLink).catch(() => Alert.alert(t.linkError || "Link error", t.couldNotOpenPortal || "Could not open portal."));
  };

  return (
    <View style={[styles.card, { backgroundColor: color }]}>
        <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={2}>{title}</Text>
                <View style={[styles.tag, { backgroundColor: eligible ? '#E8F5E9' : '#FFEBEE', alignSelf: 'flex-start', marginTop: 8 }]}>
                    <Text style={[styles.tagText, { color: eligible ? '#2E7D32' : '#C62828' }]}>{eligible ? t.eligible : t.notEligible}</Text>
                </View>
            </View>
            <View style={styles.iconCircle}>
                <IconSymbol name="book.fill" size={24} color={primary} />
            </View>
        </View>
        
        <Text style={styles.cardDesc} numberOfLines={3}>{desc}</Text>
        
        <View style={styles.cardBottom}>
            <TouchableOpacity style={styles.aiButton} onPress={askGemini} disabled={loading}>
              {loading ? (
                 <ActivityIndicator size="small" color={primary} />
              ) : (
                 <>
                   <IconSymbol name="bubble.left.fill" size={16} color={primary} />
                   <Text style={[styles.aiText, { color: primary }]}>{t.aiExplain}</Text>
                 </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.applyButton, { backgroundColor: primary }]} onPress={handleApply}>
                <Text style={styles.applyText}>{t.applyNow}</Text>
                <IconSymbol name="chevron.right" size={14} color="#fff" />
            </TouchableOpacity>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 30, paddingTop: 60, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 4, opacity: 0.8, fontWeight: '500' },
  list: { padding: 20 },
  card: { padding: 20, borderRadius: 24, marginBottom: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  cardDesc: { fontSize: 15, color: '#555', marginTop: 12, marginBottom: 20, lineHeight: 22 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontWeight: '900', fontSize: 10, letterSpacing: 0.5 },
  aiButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', height: 48, borderRadius: 14, justifyContent: 'center' },
  aiText: { fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  applyButton: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 14, justifyContent: 'center', elevation: 2 },
  applyText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginRight: 6 },
});
