import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const BIOMETRIC_PROMPTED_KEY = '@kisaan_bio_prompted';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, isLoading, role } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isRoleSelection = segments[1] === 'role-selection';

    if (!user && !inAuthGroup) {
      // No session -> Go to Login
      router.replace('/(auth)/login');
    } else if (user && !role && !isRoleSelection) {
      // User logged in but NO role -> Force role selection
      router.replace('/(auth)/role-selection');
    } else if (user && role && inAuthGroup) {
      // Found session + on Auth page -> Unlock via Biometrics or go to Setup
      checkAccess();
    }
  }, [user, isLoading, segments, role]);

  const checkAccess = async () => {
    const prompted = await AsyncStorage.getItem(BIOMETRIC_PROMPTED_KEY);
    const bioEnabled = await AsyncStorage.getItem('@kisaan_biometric_enabled') === 'true';

    // 1. If Biometric is ENABLED, they must authenticate right now
    if (bioEnabled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Raitha Setu – Unlock App',
        disableDeviceFallback: false,
      });

      if (result.success) {
        router.replace('/(tabs)');
      } else {
        // Stay on login page and force them to use email if they really need to
        // But since user is not null, they'd have to logout first.
        // We'll keep them here until biometrics pass.
      }
      return;
    }

    // 2. If not enabled but we haven't asked yet -> Show Setup
    if (prompted !== 'true') {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        router.replace('/(auth)/biometric-setup');
      } else {
        await AsyncStorage.setItem(BIOMETRIC_PROMPTED_KEY, 'true');
        router.replace('/(tabs)');
      }
    } else {
      // 3. Just go to tabs
      router.replace('/(tabs)');
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    );
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

