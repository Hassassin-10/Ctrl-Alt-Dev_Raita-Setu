// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'leaf.fill': 'eco',
  'cart.fill': 'shopping-cart',
  'book.fill': 'menu-book',
  'person.2.fill': 'people',
  'person.fill': 'person',
  'bell.fill': 'notifications',
  'cloud.rain.fill': 'umbrella',
  'cloud.fill': 'wb-cloudy',
  'sun.max.fill': 'wb-sunny',
  'sparkles': 'auto-awesome',
  'xmark.circle.fill': 'cancel',
  'chart.bar.fill': 'bar-chart',
  'dollarsign.circle': 'monetization-on',
  'phone.fill': 'phone',
  'gearshape.2.fill': 'settings',
  'briefcase.fill': 'work',
  'creditcard.fill': 'payment',
  'clock.fill': 'schedule',
  'calendar.badge.checkmark': 'event-available',
  'person.badge.shield.checkmark.fill': 'verified-user',
} as IconMapping;

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
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
