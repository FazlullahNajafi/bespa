import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Icon, type IconName } from '@/components/icon';
import type { MyPrivacy, PrivacyLevel } from '@/api/profile';
import { fontFamily, space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The privacy controls of spec 03.4, as one form.
 *
 * Shared by the onboarding step and the profile settings screen rather than written
 * twice: the spec requires the same controls in both places, and two copies is how they
 * come to disagree about what a setting means.
 *
 * Three choices per field and not a switch, because the phone number has three states and
 * a switch cannot show the middle one. The other two fields offer two of the same three,
 * so the control reads identically down the screen — the shape of the choice does not
 * change as you scroll, only which options are on offer.
 */

type FieldKey = 'show_avatar' | 'show_occupation' | 'show_phone';

/**
 * Spec 03.4 offers 'officials' for the phone number alone. It is not a UI simplification:
 * `directory_members` masks the avatar and occupation on equality with 'villagers', so an
 * avatar stored as 'officials' would simply vanish. `set_my_privacy` refuses that value
 * for those two columns for the same reason.
 */
const FIELDS: { key: FieldKey; icon: IconName; options: PrivacyLevel[] }[] = [
  { key: 'show_avatar', icon: 'camera', options: ['villagers', 'nobody'] },
  { key: 'show_occupation', icon: 'user', options: ['villagers', 'nobody'] },
  { key: 'show_phone', icon: 'phone', options: ['villagers', 'officials', 'nobody'] },
];

type Props = {
  value: MyPrivacy;
  onChange: (next: MyPrivacy) => void;
  /** Disables every control — while a save is in flight. */
  busy?: boolean;
};

export function PrivacyForm({ value, onChange, busy = false }: Props) {
  const { t } = useTranslation();
  const colors = useColors();

  // Opting out of the directory hides the profile from co-villagers outright, which makes
  // the three field settings moot. Saying so, and dimming them, is more honest than
  // leaving three live-looking controls that no longer decide anything.
  const listed = value.in_directory;

  return (
    <View style={styles.wrapper}>
      {/* Spec 03.4 asks for this sentence, in these words. It is the whole privacy model
          in one line, and it is the thing a user actually needs to know. */}
      <View style={[styles.assurance, { backgroundColor: colors.infoSurface }]}>
        <Icon name="shield" size={18} color={colors.primary} />
        <Text style={[type.bodySmall, styles.assuranceText, { color: colors.text }]}>
          {t('privacy.assurance')}
        </Text>
      </View>

      {/* Name is in the table too, with one option — so it is stated rather than
          offered. A control with nothing to choose is a false promise. */}
      <Card>
        <View style={styles.rowHead}>
          <Icon name="user" size={18} color={colors.textSecondary} />
          <Text style={[type.bodySmall, styles.label, { color: colors.text }]}>
            {t('privacy.fields.name.label')}
          </Text>
        </View>
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('privacy.fields.name.always')}
        </Text>
      </Card>

      {FIELDS.map((field) => (
        <Card key={field.key}>
          <View style={styles.rowHead}>
            <Icon name={field.icon} size={18} color={colors.textSecondary} />
            <Text style={[type.bodySmall, styles.label, { color: colors.text }]}>
              {t(`privacy.fields.${field.key}.label`)}
            </Text>
          </View>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {t(`privacy.fields.${field.key}.help`)}
          </Text>

          <View style={[styles.options, listed ? undefined : styles.inert]}>
            {field.options.map((option) => (
              <Chip
                key={option}
                label={t(`privacy.levels.${option}`)}
                selected={value[field.key] === option}
                onPress={
                  busy || !listed ? undefined : () => onChange({ ...value, [field.key]: option })
                }
                accessibilityHint={t(`privacy.levels.hint.${option}`)}
              />
            ))}
          </View>
        </Card>
      ))}

      <Card>
        <View style={styles.rowHead}>
          <Icon name="people" size={18} color={colors.textSecondary} />
          <Text style={[type.bodySmall, styles.label, { color: colors.text }]}>
            {t('privacy.fields.in_directory.label')}
          </Text>
        </View>
        <Text style={[type.caption, { color: colors.textSecondary }]}>
          {t('privacy.fields.in_directory.help')}
        </Text>

        <View style={styles.options}>
          <Chip
            label={t('privacy.listed')}
            selected={listed}
            onPress={busy ? undefined : () => onChange({ ...value, in_directory: true })}
          />
          <Chip
            label={t('privacy.unlisted')}
            selected={!listed}
            onPress={busy ? undefined : () => onChange({ ...value, in_directory: false })}
          />
        </View>

        {!listed ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[type.caption, { color: colors.warning }]}
          >
            {t('privacy.unlistedNote')}
          </Text>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.md },
  assurance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: 12,
  },
  assuranceText: { flex: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontFamily: fontFamily.semibold, fontWeight: '600', flex: 1 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  // Dims the choices alone, not the whole card: the sentence explaining why they are off
  // is the one thing on that card that still needs reading.
  inert: { opacity: 0.5 },
});
