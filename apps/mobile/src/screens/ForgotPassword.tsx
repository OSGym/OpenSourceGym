import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { authClient } from "../lib/auth";
import { Button, ErrorMsg, Field, styles } from "../ui";

export function ForgotPassword({
  onBack,
  onSent,
}: {
  onBack: () => void;
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!email) {
      setError("E-posta adresinizi girin.");
      return;
    }
    setBusy(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({
      email,
    });
    setBusy(false);
    if (error) {
      setError(
        error.status === 429
          ? "Çok fazla deneme. Lütfen bir dakika bekleyin."
          : "İstek gönderilemedi. Lütfen tekrar deneyin.",
      );
      return;
    }
    onSent(email);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>
        Open<Text style={styles.brandAccent}>Gym</Text>
      </Text>
      <Text style={styles.sub}>
        E-posta adresinizi girin, size bir şifre sıfırlama kodu gönderelim.
      </Text>
      <ErrorMsg text={error} />
      <Field
        label="E-posta"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Button title="Sıfırlama kodu gönder" onPress={submit} busy={busy} />
      <Pressable onPress={onBack}>
        <Text style={styles.link}>Giriş ekranına dön</Text>
      </Pressable>
    </View>
  );
}
