import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestNotificationPermissions = async () => {
  if (Platform.OS === 'web') return false;

  // Since SDK 53, remote notifications are not supported in Expo Go for Android.
  // Local notifications (which we use here) should still work.
  if (isExpoGo && Platform.OS === 'android') {
    console.warn("[Notifications] Running in Expo Go (Android). Remote push notifications are disabled, but local reminders will still work.");
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
};

export const scheduleDailyReminder = async (hour: number, minute: number) => {
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🌾 Raitha Setu: Your Farm Manager",
      body: "Good morning! Time to check your crops and daily insights. 🚜",
      data: { url: '/(tabs)/index' },
    },
    trigger: {
      hour: hour,
      minute: minute,
      repeats: true,
      type: Notifications.SchedulableTriggerInputTypes.DAILY as any,
    },
  });
};

export const cancelDailyReminder = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
