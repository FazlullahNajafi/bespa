import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/i18n';

import { Icon, type IconName } from '@/components/icon';
import { layout, semantic } from '@/theme/tokens';
import { useScheme } from '@/theme/use-scheme';

/**
 * The five tabs of the brief (spec 00): Home, Transport, Calendar, Services, Profile.
 *
 * Every tab carries an icon *and* its word, per the low-literacy requirement in spec 08.6
 * — the label is not a placeholder until icons arrive, it is permanent.
 *
 * The icons are not decorative-by-default here but they are still hidden from screen
 * readers: React Navigation already announces the tab by its label, so an announced icon
 * would double it.
 */
const TAB_ICON: Record<string, IconName> = {
  index: 'home',
  transport: 'car',
  calendar: 'flag',
  services: 'file',
  profile: 'user',
};
export default function TabsLayout() {
  const { t } = useTranslation();
  const scheme = useScheme();
  const colors = semantic(scheme);
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        // The bar has to pay the bottom inset itself. Expo draws edge-to-edge from SDK
        // 54 and Android 15 enforces it, so the window extends under the system
        // navigation bar: without this the labels end exactly where the back/home/recents
        // buttons begin — measured at y=1544 on both — and on a gesture-nav device the
        // home pill lands on top of them.
        //
        // `height` as well as padding, because padding alone shrinks the room left for
        // the icon and label rather than growing the bar.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: layout.tap + 12 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        // Without this React Navigation renders its own placeholder, which on Android is
        // an unmapped glyph (tofu) that also leaks into the tab's accessibility label.
        tabBarIcon: ({ color, focused }) => {
          const name = TAB_ICON[route.name] ?? 'circle-outline';
          return <Icon name={name} color={color} size={focused ? 24 : 22} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="transport" options={{ title: t('tabs.transport') }} />
      <Tabs.Screen name="calendar" options={{ title: t('tabs.calendar') }} />
      <Tabs.Screen name="services" options={{ title: t('tabs.services') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
