import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { authClient } from "../lib/auth";
import { getDeviceFingerprint } from "../lib/fingerprint";
import { Button, ErrorMsg, Field, styles } from "../ui";

export function Login({
  onRegister,
  onNeedsVerification,
  onForgot,
}: {
  onRegister: () => void;
  onNeedsVerification: (email: string, password: string) => void;
  onForgot: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const fp = await getDeviceFingerprint();
    const { error } = await authClient.signIn.email({
      email,
      password,
      fetchOptions: fp ? { headers: { "X-Device-Fingerprint": fp } } : undefined,
    });
    setBusy(false);
    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        await authClient.emailOtp.sendVerificationOtp({
          email,
          type: "email-verification",
        });
        onNeedsVerification(email, password);
        return;
      }
      setError(
        error.status === 429
          ? "Çok fazla deneme. Lütfen bir dakika bekleyin."
          : "E-posta veya şifre hatalı.",
      );
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>
        Open<Text style={styles.brandAccent}>Gym</Text>
      </Text>
      <Text style={styles.sub}>Üye girişi</Text>
      <ErrorMsg text={error} />
      <Field
        label="E-posta"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Field
        label="Şifre"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />
      <Button title="Giriş yap" onPress={submit} busy={busy} />
      <Pressable onPress={onForgot}>
        <Text style={styles.link}>Şifremi unuttum</Text>
      </Pressable>
      <Pressable onPress={onRegister}>
        <Text style={styles.link}>Hesabın yok mu? Kayıt ol</Text>
      </Pressable>
    </View>
  );
}
