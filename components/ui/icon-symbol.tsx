// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconSymbolName = SymbolViewProps['name'] | 'whatsapp.fill';

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: Record<string, ComponentProps<typeof MaterialIcons>['name']> = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'leaf.fill': 'eco',
  'cart.fill': 'shopping-cart',
  'book.fill': 'menu-book',
  'person.2.fill': 'people',
  'person.3.fill': 'groups',
  'person.fill': 'person',
  'person.crop.circle.fill': 'account-circle',
  'bell.fill': 'notifications',
  'cloud.rain.fill': 'umbrella',
  'cloud.fill': 'wb-cloudy',
  'sun.max.fill': 'wb-sunny',
  'sparkles': 'auto-awesome',
  'xmark.circle.fill': 'cancel',
  'chart.bar.fill': 'bar-chart',
  'dollarsign.circle': 'monetization-on',
  'phone.fill': 'phone',
  'gearshape.fill': 'settings',
  'gearshape.2.fill': 'settings',
  'briefcase.fill': 'work',
  'creditcard.fill': 'payment',
  'clock.fill': 'schedule',
  'calendar.badge.checkmark': 'event-available',
  'person.badge.shield.checkmark.fill': 'verified-user',
  'magnifyingglass': 'search',
  'square.and.arrow.up': 'share',
  'location.fill': 'location-on',
  'trash.fill': 'delete',
  'plus': 'add',
  'camera.fill': 'photo-camera',
  'tray.fill': 'inbox',
  'checkmark.circle.fill': 'check-circle',
  'indianrupeesign.circle.fill': 'paid',
  'slider.horizontal.3': 'tune',
  'eye': 'visibility',
  'eye.slash': 'visibility-off',
  'message.fill': 'chat',
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  if (name === 'whatsapp.fill') {
    return <FontAwesome color={color} size={size} name="whatsapp" style={style} />;
  }
  return <MaterialIcons color={color} size={size} name={MAPPING[name as any]} style={style} />;
}
