import { Tabs } from 'expo-router';
import { useTranslation } from '@/i18n';

import { layout, semantic } from '@/theme/tokens';
import { useScheme } from '@/theme/use-scheme';

/**
 * The five tabs of the brief (spec 00): Home, Transport, Calendar, Services, Profile.
 * Icons land with the illustration set (spec 08.3); labels carry the screen for now,
 * because an icon without a word fails the low-literacy requirement in 08.6.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const scheme = useScheme();
  const colors = semantic(scheme);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: layout.tap + 12,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="transport" options={{ title: t('tabs.transport') }} />
      <Tabs.Screen name="calendar" options={{ title: t('tabs.calendar') }} />
      <Tabs.Screen name="services" options={{ title: t('tabs.services') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
