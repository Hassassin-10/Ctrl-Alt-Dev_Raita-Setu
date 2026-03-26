import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput, Dimensions, Image, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { db } from '@/services/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useEffect } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

const { width } = Dimensions.get('window');

// LOCAL ASSETS
const TOMATO_IMG = require('../assets/images/community_tomato.png');
const WHEAT_IMG = require('../assets/images/community_wheat.png');
const RICE_IMG = require('../assets/images/community_rice.png');

const INITIAL_POSTS = [
  {
    id: '1',
    author: 'Somanna K.',
    role: 'Farmer',
    date: '2h ago',
    question: 'How to control white flies in Tomato crop? My crop is 45 days old.',
    image: TOMATO_IMG,
    answers: [
      {
        id: 'a1',
        author: 'Dr. Ramesh (Agri Expert)',
        text: 'Use yellow sticky traps (10/acre) and spray Neem Oil (3000ppm). If severe, use Acetamiprid 20% SP.',
        upvotes: 42
      }
    ],
    comments: [
      { id: 'c1', author: 'Basappa', text: 'Thanks doctor, very helpful!' },
      { id: 'c2', author: 'Mallesh', text: 'I faced the same last year, Neem oil worked well.' }
    ],
    tags: ['Tomato', 'Pest Control']
  },
  {
    id: '2',
    author: 'Rajesh Sharma',
    role: 'Farmer',
    date: '5h ago',
    question: 'Is it the right time to sell Wheat in Mandya? Prices seem stable but I expect a rise.',
    image: WHEAT_IMG,
    answers: [
      {
        id: 'a2',
        author: 'Krishi Advisor',
        text: 'Agmarknet data shows a 5% supply drop next week. Suggest holding for 7 days if you have storage.',
        upvotes: 28
      }
    ],
    comments: [],
    tags: ['Wheat', 'Market']
  },
  {
    id: '3',
    author: 'Anjali M.',
    role: 'Labourer',
    date: '1d ago',
    question: 'Looking for sowing work in Kolar. Any farmers hiring for next week?',
    image: RICE_IMG,
    answers: [
      {
        id: 'a3',
        author: 'Gowda Farms',
        text: 'We need 5 people from Monday. Check the Labour Hub for our post!',
        upvotes: 15
      }
    ],
    comments: [
      { id: 'c3', author: 'Raghu', text: 'I am also looking for work in the same area.' }
    ],
    tags: ['Work', 'Kolar']
  }
];

export default function CommunityScreen() {
  const { t, user, profile, role } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const router = useRouter();

  const [posts, setPosts] = useState<any[]>(INITIAL_POSTS);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', desc: '', category: 'General', image: null as string | null });
  const [uploading, setUploading] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // Fetch posts from Firestore and merge with INITIAL_POSTS
  useEffect(() => {
    const q = query(collection(db, 'community_posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Merge: Live posts first, then the hardcoded mocks as fallbacks/starters
      setPosts([...fetchedPosts, ...INITIAL_POSTS]);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLike = (postId: string) => {
    const newLikedPosts = new Set(likedPosts);
    if (newLikedPosts.has(postId)) {
      newLikedPosts.delete(postId);
    } else {
      newLikedPosts.add(postId);
    }
    setLikedPosts(newLikedPosts);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.1, // Compress for Firestore
      base64: true
    });
    if (!result.canceled && result.assets[0].base64) {
      setNewPost(prev => ({
        ...prev,
        image: `data:image/jpeg;base64,${result.assets[0].base64}`
      }));
    }
  };

  const handlePostQuestion = async () => {
    if (!newPost.title || !newPost.desc) {
      Alert.alert("Missing Information", "Please enter a title and description.");
      return;
    }

    setUploading(true);
    try {
      const postData = {
        author: profile?.name || user?.displayName || 'Farmer',
        role: role || 'Farmer',
        date: 'Now',
        question: newPost.title,
        description: newPost.desc,
        image: newPost.image || null,
        answers: [],
        comments: [],
        tags: [newPost.category],
        createdAt: Timestamp.now(),
        userId: user?.uid || 'anonymous'
      };

      await addDoc(collection(db, 'community_posts'), postData);
      
      setModalVisible(false);
      setNewPost({ title: '', desc: '', category: 'General', image: null });
      Alert.alert("Success", "Your question has been posted!");
    } catch (e: any) {
      console.error("Post Error:", e);
      Alert.alert("Error", "Could not post your question. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!commentText) return;
    // For INITIAL_POSTS (which don't have Firestore IDs), just update locally
    if (INITIAL_POSTS.some(p => p.id === postId)) {
        const updatedPosts = posts.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: [...p.comments, { id: Math.random().toString(), author: 'You', text: commentText }]
            };
          }
          return p;
        });
        setPosts(updatedPosts);
        setCommentText('');
        setActiveCommentId(null);
        return;
    }

    try {
      const postRef = doc(db, 'community_posts', postId);
      await updateDoc(postRef, {
        comments: arrayUnion({
          id: Math.random().toString(),
          author: profile?.name || user?.displayName || 'Farmer',
          text: commentText,
          createdAt: Timestamp.now()
        })
      });
      setCommentText('');
      setActiveCommentId(null);
    } catch (e: any) {
      console.error("Comment Error:", e);
      Alert.alert("Error", "Could not add comment.");
    }
  };

  const renderItem = ({ item }: { item: typeof INITIAL_POSTS[0] }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.authorBadge}>
          <Text style={styles.authorInitial}>{item.author[0]}</Text>
        </View>
        <View>
          <Text style={styles.authorName}>{item.author} • <Text style={styles.authorRole}>{item.role}</Text></Text>
          <Text style={styles.postDate}>{item.date}</Text>
        </View>
      </View>

      <Text style={styles.questionText}>{item.question}</Text>

      {item.image && (
        <Image
          source={typeof item.image === 'string' ? { uri: item.image } : item.image}
          style={styles.cardImage}
          resizeMode="cover"
        />
      )}

      <View style={styles.tagRow}>
        {item.tags.map(tag => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>#{tag}</Text>
          </View>
        ))}
      </View>

      {item.answers.length > 0 && (
        <View style={styles.bestAnswer}>
          <View style={styles.answerHeader}>
            <IconSymbol name="checkmark.circle.fill" size={14} color="#2E7D32" />
            <Text style={styles.expertName}>{item.answers[0].author}</Text>
          </View>
          <Text style={styles.answerText}>{item.answers[0].text}</Text>
        </View>
      )}

      {/* Comments Section */}
      <View style={styles.commentsContainer}>
        <View style={styles.commentHeaderRow}>
          <Text style={styles.commentsTitle}>{t.comments} ({item.comments.length})</Text>
          <TouchableOpacity onPress={() => setActiveCommentId(activeCommentId === item.id ? null : item.id)}>
            <Text style={styles.addCommentBtn}>{t.addComment.split('.')[0]}</Text>
          </TouchableOpacity>
        </View>

        {item.comments.map(c => (
          <View key={c.id} style={styles.commentItem}>
            <Text style={styles.commentAuthor}>{c.author}: <Text style={styles.commentText}>{c.text}</Text></Text>
          </View>
        ))}

        {activeCommentId === item.id && (
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder={t.addComment}
              value={commentText}
              onChangeText={setCommentText}
              autoFocus
            />
            <TouchableOpacity onPress={() => handleAddComment(item.id)}>
              <IconSymbol name="paperplane.fill" size={20} color="#2E7D32" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.postFooter}>
        <TouchableOpacity style={styles.footerAction} onPress={() => handleLike(item.id)}>
          <Text style={{ fontSize: 18 }}>
            {likedPosts.has(item.id) ? '❤️' : '🤍'}
          </Text>
          <Text style={[styles.actionText, likedPosts.has(item.id) && { color: 'red' }]}>
            {(item.answers[0]?.upvotes || 0) + (likedPosts.has(item.id) ? 1 : 0)} {t.upvote}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerAction}>
          <IconSymbol name="bubble.left" size={18} color="#666" />
          <Text style={styles.actionText}>{t.answers} ({item.answers.length})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()}>
              <IconSymbol name="chevron.left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t.communityQnA}</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.searchBar}>
            <IconSymbol name="magnifyingglass" size={18} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder={t.searchQuestions}
              placeholderTextColor="#999"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      ) : (
        <FlatList
          data={posts.filter(p => 
            p.question.toLowerCase().includes(search.toLowerCase()) || 
            (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
          )}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <LinearGradient colors={['#43A047', '#2E7D32']} style={styles.fabGradient}>
          <IconSymbol name="pencil.and.outline" size={24} color="#fff" />
          <Text style={styles.fabText}>{t.askQuestion}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ASK QUESTION MODAL */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <BlurView intensity={30} tint="dark" style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <IconSymbol name="chevron.left" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t.askQuestion}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>{t.postTitle}</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Tomato Leaf disease"
                value={newPost.title}
                onChangeText={t => setNewPost({ ...newPost, title: t })}
              />

              <Text style={styles.label}>{t.postDescription}</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                multiline
                placeholder={t.postDescription}
                value={newPost.desc}
                onChangeText={d => setNewPost({ ...newPost, desc: d })}
              />
              <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage}>
                <IconSymbol name="camera.fill" size={20} color="#2E7D32" />
                <Text style={styles.attachText}>{newPost.image ? "Change Photo" : t.attachPhoto}</Text>
              </TouchableOpacity>

              {newPost.image && (
                <Image source={{ uri: newPost.image }} style={styles.imagePreview} />
              )}

              <TouchableOpacity 
                style={[styles.submitBtn, uploading && { opacity: 0.7 }]} 
                onPress={handlePostQuestion}
                disabled={uploading}
              >
                {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{t.submitQuestion}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  header: { paddingBottom: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  headerContent: { paddingHorizontal: 20, paddingTop: 50 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginTop: 20, paddingHorizontal: 15, height: 48, borderRadius: 15 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#333' },
  list: { padding: 18, paddingBottom: 100 },
  postCard: { backgroundColor: '#fff', borderRadius: 22, padding: 20, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  authorBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  authorInitial: { color: '#2E7D32', fontWeight: 'bold', fontSize: 18 },
  authorName: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A' },
  authorRole: { fontWeight: 'normal', color: '#777', fontSize: 13 },
  postDate: { fontSize: 11, color: '#999', marginTop: 3 },
  questionText: { fontSize: 17, color: '#1A1A1A', fontWeight: '700', lineHeight: 26, marginBottom: 12 },
  cardImage: { width: '100%', height: 200, borderRadius: 15, marginBottom: 15 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  tag: { backgroundColor: '#f0f4f8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 10, marginBottom: 6 },
  tagText: { fontSize: 12, color: '#455A64', fontWeight: 'bold' },
  bestAnswer: { backgroundColor: '#F1F8E9', borderRadius: 12, padding: 15, borderLeftWidth: 4, borderLeftColor: '#4CAF50', marginBottom: 15 },
  answerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  expertName: { fontSize: 13, fontWeight: 'bold', color: '#2E7D32', marginLeft: 8 },
  answerText: { fontSize: 14, color: '#333', lineHeight: 22 },
  commentsContainer: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 15, paddingBottom: 10 },
  commentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  commentsTitle: { fontSize: 14, fontWeight: 'bold', color: '#555' },
  addCommentBtn: { fontSize: 13, color: '#2E7D32', fontWeight: 'bold' },
  commentItem: { marginBottom: 8, paddingHorizontal: 5 },
  commentAuthor: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  commentText: { fontWeight: 'normal', color: '#666' },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, gap: 10 },
  commentInput: { flex: 1, fontSize: 14, color: '#333' },
  postFooter: { flexDirection: 'row', marginTop: 10, gap: 25 },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 13, color: '#666', fontWeight: '600' },
  fab: { position: 'absolute', bottom: 30, alignSelf: 'center', elevation: 8 },
  fabGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 14, borderRadius: 30 },
  fabText: { color: '#fff', fontWeight: 'bold', marginLeft: 10, fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  label: { fontSize: 15, fontWeight: 'bold', color: '#444', marginBottom: 10, marginTop: 15 },
  input: { backgroundColor: '#f8f8f8', borderRadius: 15, padding: 15, fontSize: 16, color: '#333', borderWidth: 1, borderColor: '#eee' },
  attachBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, alignSelf: 'flex-start', padding: 12, backgroundColor: '#E8F5E9', borderRadius: 12 },
  attachText: { color: '#2E7D32', fontWeight: 'bold' },
  imagePreview: { width: '100%', height: 180, borderRadius: 15, marginTop: 15 },
  submitBtn: { backgroundColor: '#2E7D32', borderRadius: 15, padding: 18, alignItems: 'center', marginTop: 30, elevation: 4 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});
