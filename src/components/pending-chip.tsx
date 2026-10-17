import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTranslation } from '@/i18n';
import { Icon } from '@/components/icon';
import { drain, pendingCount, subscribe } from '@/lib/outbox';
import { useConnectivity } from '@/lib/net';
import { fontFamily, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Unsent work, bound to the outbox (spec 10.4 step 5).
 *
 * Renders nothing when the queue is empty, which is almost always. It appears only when
 * the user has done something the server has not yet accepted — the honest answer to
 * "did my notice post?" on a connection that drops every few minutes.
 *
 * Tapping it forces a drain, so someone who can see they are back on signal does not have
 * to wait for the reconnect event.
 */
export function PendingChip() {
  const { t } = useTranslation();
  const colors = useColors();
  const { online } = useConnectivity();
  const [pending, setPending] = useState(0);

  const refresh = useCallback(() => {
    void pendingCount().then(setPending);
  }, []);

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);

  if (pending === 0) return null;

  const label = online
    ? t('outbox.sending', { count: pending })
    : t('outbox.waiting', { count: pending });

  return (
    <Pressable
      onPress={() => void drain()}
      disabled={!online}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={online ? t('outbox.retryHint') : undefined}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: online ? colors.primary : colors.warning,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Icon
        name={online ? 'send' : 'clock'}
        size={14}
        color={online ? colors.primary : colors.warning}
        strokeWidth={2}
      />
      <Text
        style={[type.caption, styles.label, { color: colors.text }]}
        numberOfLines={1}
        accessibilityLiveRegion="polite"
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { fontFamily: fontFamily.semibold },
});
