import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Icon, type IconName } from '@/components/icon';
import { isOfficial, type Notice } from '@/api/notices';
import { relativeDate } from '@/lib/relative-date';
import { fontFamily, layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * One notice in a list (spec 03.1 section 6, 03.5).
 *
 * Two things this has to get right, both about trust rather than looks.
 *
 * An **official** notice must be unmistakably official, and unmistakably not ours: Bespa
 * has no LAHDC sponsor (spec 09.4 #2), so a mirrored notice carries its source's name
 * and says it opens the original document. Anything less and the app reads as a
 * government channel, which it is not.
 *
 * An **alert** must not rely on colour (spec 08.1). It gets the warning hue, a glyph,
 * and the word — the categories are shown as icon *and* word throughout, for the
 * low-literacy requirement in spec 08.6.
 */

const CATEGORY_ICON: Record<Notice['category'], IconName> = {
  alert: 'bell',
  order: 'file',
  event: 'flag',
  vacation: 'sun',
  general: 'chat',
};

type Props = {
  notice: Notice;
  onPress: () => void;
};

export function NoticeCard({ notice, onPress }: Props) {
  const { t } = useTranslation();
  const colors = useColors();

  const official = isOfficial(notice);
  const urgent = notice.category === 'alert';
  const when = relativeDate(notice.published_at);
  const align = I18nManager.isRTL ? ('right' as const) : ('left' as const);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        official
          ? t('notices.a11yOfficial', {
              title: notice.title,
              source: notice.notice_sources?.label ?? '',
            })
          : notice.title
      }
      accessibilityHint={t(official ? 'notices.opensOriginal' : 'notices.opensNotice')}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.surface,
          // An alert is bordered in the warning colour, but the colour is never the
          // signal on its own — the chip below carries the glyph and the word too.
          borderColor: urgent ? colors.warning : colors.borderSoft,
          borderWidth: urgent ? 1.5 : StyleSheet.hairlineWidth * 2,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.meta}>
        <View style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
          <Icon
            name={CATEGORY_ICON[notice.category]}
            size={13}
            color={urgent ? colors.warning : colors.textSecondary}
          />
          <Text
            style={[
              type.caption,
              styles.chipText,
              { color: urgent ? colors.warning : colors.textSecondary },
            ]}
          >
            {t(`notices.category.${notice.category}`)}
          </Text>
        </View>

        {notice.is_pinned ? (
          <Icon name="pin" size={14} color={colors.primary} label={t('notices.pinned')} />
        ) : null}

        <View style={styles.spacer} />

        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t(when.key, when.values)}
        </Text>
      </View>

      <Text
        style={[type.bodySmall, styles.title, { color: colors.text, textAlign: align }]}
        numberOfLines={3}
      >
        {notice.title}
      </Text>

      {/* Attribution, not decoration. A reader has to be able to tell at a glance
          whether these are the district's words or a neighbour's. */}
      {official ? (
        <View style={styles.source}>
          <Icon name="shield" size={13} color={colors.info} />
          <Text style={[type.caption, { color: colors.info }]} numberOfLines={1}>
            {notice.notice_sources?.label ?? t('notices.official')}
          </Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {t('notices.pdf')}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.card,
    minHeight: layout.tap,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  spacer: { flex: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  chipText: { fontFamily: fontFamily.semibold },
  title: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  source: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
