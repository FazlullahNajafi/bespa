import { useState } from 'react';
import { Link } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { useTranslation } from '@/i18n';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { signIn } from '@/api/auth';
import { validateEmail, validatePassword } from '@/features/auth/validate';
import { space, type } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const next = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;

    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);

    // On success the auth listener in the session store fires and the root layout's gate
    // navigates — this screen does not route itself.
    if (!result.ok) setFormError(`errors.${result.code}`);
  }

  return (
    <Screen
      footer={
        <>
          <Button
            label={t('auth.signIn.action')}
            onPress={onSubmit}
            loading={busy}
            disabled={busy}
          />
          <Link href="/(auth)/sign-up" style={styles.link}>
            <Text style={[type.bodySmall, { color: colors.primary }]}>
              {t('auth.signIn.toSignUp')}
            </Text>
          </Link>
        </>
      }
    >
      <View style={styles.header}>
        <Text style={[type.display, { color: colors.text }]}>{t('auth.signIn.title')}</Text>
        <Text style={[type.body, { color: colors.textSecondary }]}>
          {t('auth.signIn.subtitle')}
        </Text>
      </View>

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
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={onSubmit}
        returnKeyType="go"
      />

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
