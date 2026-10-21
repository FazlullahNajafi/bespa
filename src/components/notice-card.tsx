import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';

import i18n, { useTranslation } from '@/i18n';
import { Icon, type IconName } from '@/components/icon';
import { isOfficial, type Notice } from '@/api/notices';
import { formatDay } from '@/lib/format-date';
import { openNoticeDocument, shareNotice } from '@/lib/notice-actions';
import { noticeShareText } from '@/lib/notice-share';
import { relativeDate } from '@/lib/relative-date';
import { fontFamily, layout, radius, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * One notice in a list (spec 03.1 section 6, 03.5).
 *
 * The card is the whole interface for a mirrored notice. There is no screen between it
 * and the document: tapping it — or its PDF button — opens the original, because a page
 * whose only content was the source's name and a disclaimer was a step that told the
 * reader nothing they could not already see here. A *village* notice still has its own
 * screen, because it has words to read.
 *
 * Three things this has to get right, all about trust rather than looks.
 *
 * An **official** notice must be unmistakably official, and unmistakably not ours: Bespa
 * has no sponsor at the District Administration (spec 09.4 #2). It carries a shield and
 * the word, while the administration's full name and the disclaimer are stated once at
 * the top of the list rather than repeated under every row.
 *
 * An **alert** must not rely on colour (spec 08.1). It gets the warning hue, a glyph,
 * and the word — the categories are shown as icon *and* word throughout, for the
 * low-literacy requirement in spec 08.6.
 *
 * **Share** is a first-class action, not a detail-screen afterthought. A notice reaches
 * most people here because a neighbour forwarded it on WhatsApp, so forwarding is one
 * tap from the list.
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
  /** Where a village notice's own screen lives; a mirrored one opens its PDF instead. */
  onOpenDetail: () => void;
};

/** An action inside the card. Its own 44pt target (spec 08.6), icon *and* word. */
function CardAction({
  icon,
  label,
  hint,
  onPress,
  tint,
}: {
  icon: IconName;
  label: string;
  hint: string;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={16} color={tint} />
      <Text style={[type.caption, styles.actionText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function NoticeCard({ notice, onOpenDetail }: Props) {
  const { t } = useTranslation();
  const colors = useColors();

  const official = isOfficial(notice);
  const urgent = notice.category === 'alert';
  const when = relativeDate(notice.published_at);
  const align = I18nManager.isRTL ? ('right' as const) : ('left' as const);
  const document = official ? notice.source_url : null;

  function open() {
    if (document) void openNoticeDocument(document);
    else onOpenDetail();
  }

  function share() {
    const expires = notice.expires_at ? new Date(notice.expires_at) : null;

    // The wording lives in `notice-share`, where it can be tested: a forwarded notice is
    // the first thing most people here will ever see of Bespa.
    void shareNotice(
      noticeShareText({
        title: notice.title,
        // The document's own link for a mirrored notice, the words themselves for a
        // village one — a notice forwarded without either is not worth forwarding.
        body: official ? '' : notice.body,
        categoryLabel: t(`notices.category.${notice.category}`),
        publishedLabel: t('notices.sharePublished', {
          date: formatDay(new Date(notice.published_at), i18n.language),
        }),
        expiresLabel: expires
          ? t('notices.until', { date: formatDay(expires, i18n.language) })
          : null,
        sourceLabel: official ? (notice.notice_sources?.label ?? null) : null,
        documentUrl: document,
        footer: t('notices.shareFooter'),
      }),
    );
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={
        official
          ? t('notices.a11yOfficial', {
              title: notice.title,
              source: notice.notice_sources?.label ?? t('notices.official'),
            })
          : notice.title
      }
      accessibilityHint={t(document ? 'notices.opensPdf' : 'notices.opensNotice')}
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

      <View style={[styles.actions, { borderTopColor: colors.borderSoft }]}>
        {/* Whose notice this is, in two words' worth of room. The body's name and the
            disclaimer are stated once per list, not once per card. */}
        {official ? (
          <View style={styles.badge}>
            <Icon name="shield" size={13} color={colors.info} />
            <Text style={[type.caption, { color: colors.info }]}>{t('notices.official')}</Text>
          </View>
        ) : null}

        <View style={styles.spacer} />

        {document ? (
          <CardAction
            icon="file"
            label={t('notices.pdf')}
            hint={t('notices.opensPdf')}
            onPress={() => void openNoticeDocument(document)}
            tint={colors.primary}
          />
        ) : null}

        <CardAction
          icon="share"
          label={t('notices.share')}
          hint={t('notices.sharesNotice')}
          onPress={share}
          tint={colors.primary}
        />
      </View>
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
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.xs,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: layout.tap,
    minWidth: layout.tap,
    paddingHorizontal: space.sm,
  },
  actionText: { fontFamily: fontFamily.semibold },
});
