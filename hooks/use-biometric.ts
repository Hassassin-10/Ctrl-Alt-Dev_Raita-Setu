/**
 * useBiometric — Raitha Setu Biometric Authentication Hook
 */

import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = '@kisaan_biometric_enabled';

export type BiometricStatus =
  | 'checking'
  | 'unavailable'      // hardware not present
  | 'not_enrolled'     // hardware exists but no fingerprint saved
  | 'available'        // hardware & enrollment ready (ignore user pref for UI display)
  | 'disabled';        // (legacy)

export interface BiometricResult {
  success: boolean;
  error?: string;
}

export function useBiometric() {
  const [status, setStatus] = useState<BiometricStatus>('checking');
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false); // User preference in app
  const [supportedTypes, setSupportedTypes] = useState<LocalAuthentication.AuthenticationType[]>([]);

  const checkBiometricStatus = useCallback(async () => {
    try {
      console.log("[Biometric] Starting status check...");
      
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      console.log("[Biometric] Hardware detected:", hasHardware);
      if (!hasHardware) {
        setStatus('unavailable');
        return;
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      console.log("[Biometric] User enrolled in OS:", enrolled);
      setIsEnrolled(enrolled);
      
      if (!enrolled) {
        setStatus('not_enrolled');
        return;
      }

      // Hardware exists and user is enrolled -> Button should be available
      setStatus('available');

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      console.log("[Biometric] Supported types:", types);
      setSupportedTypes(types);

      const stored = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      setIsEnabled(stored === 'true');
      console.log("[Biometric] App-level enabled state:", stored === 'true');

    } catch (error) {
      console.error("[Biometric] Error during check:", error);
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    checkBiometricStatus();
  }, [checkBiometricStatus]);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, String(enabled));
    setIsEnabled(enabled);
    console.log("[Biometric] Preference saved:", enabled);
  }, []);

  const authenticate = useCallback(async (): Promise<BiometricResult> => {
    try {
      console.log("[Biometric] Triggering authentication prompt...");
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate with Raitha Setu',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });


      if (result.success) {
        return { success: true };
      }

      const resError = result.error || (result as any).warning || 'failed';

      const errorMap: Record<string, string> = {
        UserCancel: 'Authentication cancelled.',
        user_cancel: 'Authentication cancelled.',
        UserFallback: 'Please enter your device passcode.',
        user_fallback: 'Please enter your device passcode.',
        SystemCancel: 'System interrupted.',
        PasscodeNotSet: 'No lock screen set on device.',
        BiometryNotAvailable: 'Biometrics not available.',
        BiometryNotEnrolled: 'Please enroll a fingerprint in settings.',
        BiometryLockout: 'Locked out. Try again later.',
      };

      const msg = errorMap[resError] || `Auth failed: ${resError}`;
      return { success: false, error: msg };
    } catch (e: any) {
      console.error("[Biometric] Prompt Error:", e);
      return { success: false, error: e.message ?? 'Unexpected error.' };
    }
  }, []);

  const biometricLabel = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? 'Face ID'
    : supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
    ? 'Fingerprint'
    : 'Biometric';

  return {
    status,
    isEnabled,
    isEnrolled,
    biometricLabel,
    supportedTypes,
    authenticate,
    setBiometricEnabled,
    refresh: checkBiometricStatus,
  };
}
