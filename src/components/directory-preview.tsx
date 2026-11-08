import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTranslation } from '@/i18n';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { useDirectory, useVillageContacts } from '@/api/directory';
import { dial } from '@/lib/dial';
import { fontFamily, layout, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Home's directory section (spec 03.1 §8): the sarpanch, with a call button, and a way
 * through to everyone else.
 *
 * **The sarpanch is the first panchayat contact card, not a search for the word.** Those
 * cards are ordered by `sort_order` precisely so an admin can decide who sits at the
 * top, and matching on a designation string would break the moment someone wrote
 * "Sarpanch (acting)" or the Urdu for it. Whoever the admin put first is who the village
 * is told to ring.
 *
 * **The number is shown and dialled directly.** Spec 03.4 treats an office holder's
 * number as public within the village, which is why these cards carry it openly while
 * an ordinary member's is behind the rate-limited, audited reveal in the directory.
 *
 * Empty, it says who can fix it. Spec 03.1's empty state for this section is "sarpanch
 * contact missing → prompt admin", and naming the person who can act is more use than
 * an apology.
 */
export function DirectoryPreview({ villageId }: { villageId: string | null | undefined }) {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const contacts = useVillageContacts(villageId);
  const members = useDirectory(villageId);

  const sarpanch = contacts.data?.[0] ?? null;
  const count = (members.data ?? []).length;

  // Nothing while the first load is in flight rather than a spinner: this sits well
  // down Home, and a village with no contacts resolves to a card either way.
  if (contacts.isPending) return null;

  return (
    <Pressable
      onPress={() => router.push('/directory')}
      accessibilityRole="button"
      accessibilityLabel={t('directory.title')}
    >
      <Card>
        {sarpanch ? (
          <View style={styles.row}>
            <Avatar name={sarpanch.name} size={44} />
            <View style={styles.rowText}>
              <Text style={[type.body, styles.name, { color: colors.text }]}>
                {sarpanch.name}
              </Text>
              <Text style={[type.caption, { color: colors.textSecondary }]}>
                {sarpanch.designation}
              </Text>
            </View>
            {/* No number, no button. A contact card can exist without one, and a Call
                that dials nothing is worse than an absent one. */}
            {sarpanch.phone ? (
              <Button
                label={t('directory.call')}
                variant="secondary"
                leading={<Icon name="phone" size={20} color={colors.primary} />}
                onPress={() => void dial(sarpanch.phone as string)}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.row}>
            <Icon name="people" size={20} color={colors.textSecondary} />
            <Text style={[type.bodySmall, styles.rowText, { color: colors.textSecondary }]}>
              {t('directory.noSarpanch')}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={[type.bodySmall, styles.grow, { color: colors.text }]}>
            {t('village.membersCount', { count })}
          </Text>
          <Icon name="chevron" size={16} color={colors.textSecondary} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.tap },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.semibold, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.sm,
    minHeight: layout.tap,
  },
  grow: { flex: 1 },
});
