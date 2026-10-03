import { Tabs } from 'expo-router';
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

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: layout.tap + 12,
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
