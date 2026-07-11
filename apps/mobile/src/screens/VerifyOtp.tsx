import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { authClient } from "../lib/auth";
import { getDeviceFingerprint } from "../lib/fingerprint";
import { Button, ErrorMsg, Field, styles } from "../ui";

export function VerifyOtp({
  email,
  password,
  onBack,
  onVerified,
}: {
  email: string;
  password: string;
  onBack: () => void;
  onVerified: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
    if (error) {
      setBusy(false);
      setError("Kod hatalı veya süresi dolmuş.");
      return;
    }
    // Doğrulama sonrası otomatik giriş — kayıt akışı kesintisiz tamamlanır
    const fp = await getDeviceFingerprint();
    const signIn = await authClient.signIn.email({
      email,
      password,
      fetchOptions: fp
        ? { headers: { "X-Device-Fingerprint": fp } }
        : undefined,
    });
    setBusy(false);
    if (signIn.error) {
      setError("Doğrulama tamam; giriş başarısız. Giriş ekranından deneyin.");
      return;
    }
    onVerified();
  }

  async function resend() {
    setInfo(null);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    if (error) {
      setError("Kod gönderilemedi. Lütfen bir dakika bekleyin.");
    } else {
      setInfo("Yeni kod gönderildi.");
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>
        Open<Text style={styles.brandAccent}>Gym</Text>
      </Text>
      <Text style={styles.sub}>
        {email} adresine gönderilen 6 haneli kodu girin.
      </Text>
      <ErrorMsg text={error} />
      {info && (
        <Text style={{ color: "#7fd069", marginBottom: 14 }}>{info}</Text>
      )}
      <Field
        label="Doğrulama kodu"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
      />
      <Button title="Doğrula" onPress={submit} busy={busy} />
      <Pressable onPress={resend}>
        <Text style={styles.link}>Kodu yeniden gönder</Text>
      </Pressable>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>Geri dön</Text>
      </Pressable>
    </View>
  );
}
