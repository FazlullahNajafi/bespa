import { useState } from 'react';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/i18n';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { signUp } from '@/api/auth';
import { MIN_PASSWORD_LENGTH, validateEmail, validateName, validatePassword } from '@/features/auth/validate';
import { space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit() {
    const next = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(next);
    setFormError(null);
    if (next.name || next.email || next.password) return;

    setBusy(true);
    const result = await signUp(email, password, name);
    setBusy(false);

    if (!result.ok) {
      setFormError(`errors.${result.code}`);
    } else if (result.needsEmailConfirmation) {
      setSentTo(email.trim());
    }
  }

  if (sentTo) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={[type.display, { color: colors.text }]}>
            {t('auth.signUp.checkEmail')}
          </Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>
            {t('auth.signUp.checkEmailBody', { email: sentTo })}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button
            label={t('auth.signUp.action')}
            onPress={onSubmit}
            loading={busy}
            disabled={busy}
          />
          <Link href="/(auth)/sign-in" style={styles.link}>
            <Text style={[type.bodySmall, { color: colors.primary }]}>
              {t('auth.signUp.toSignIn')}
            </Text>
          </Link>
        </>
      }
    >
      <View style={styles.header}>
        <Text style={[type.display, { color: colors.text }]}>{t('auth.signUp.title')}</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>
          {t('auth.signUp.subtitle')}
        </Text>
      </View>

      <TextField
        label={t('auth.fields.name')}
        value={name}
        onChangeText={setName}
        error={errors.name ? t(errors.name) : undefined}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />

      <TextField
        label={t('auth.fields.email')}
        value={email}
        onChangeText={setEmail}
        error={errors.email ? t(errors.email) : undefined}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
        textContentType="emailAddress"
      />

      <TextField
        label={t('auth.fields.password')}
        value={password}
        onChangeText={setPassword}
        error={errors.password ? t(errors.password) : undefined}
        hint={t('auth.fields.passwordHint', { count: MIN_PASSWORD_LENGTH })}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />

      {/* Says plainly that phone verification comes later, so a user without SMS does not
          abandon the form expecting to be blocked (spec 10.0 #1). */}
      <Text style={[type.caption, { color: colors.textSecondary }]}>{t('auth.phoneLater')}</Text>

      {formError ? (
        <View style={[styles.banner, { backgroundColor: colors.infoSurface }]}>
          <Text accessibilityLiveRegion="polite" style={[type.bodySmall, { color: colors.danger }]}>
            {t(formError)}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  link: { paddingVertical: space.sm, textAlign: 'center' },
  banner: { padding: space.md, borderRadius: 12 },
});
