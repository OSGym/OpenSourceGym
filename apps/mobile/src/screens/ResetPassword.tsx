import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { authClient } from "../lib/auth";
import { Button, ErrorMsg, Field, styles } from "../ui";
import { colors } from "../theme";

export function ResetPassword({
  email,
  onDone,
  onBack,
}: {
  email: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit() {
    setError(null);
    setInfo(null);
    if (otp.length !== 6) {
      setError("6 haneli doğrulama kodunu girin.");
      return;
    }
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalı.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setBusy(true);
    const { error } = await authClient.emailOtp.resetPassword({
      email,
      otp,
      password,
    });
    setBusy(false);
    if (error) {
      if (error.status === 429) {
        setError("Çok fazla deneme. Lütfen bir dakika bekleyin.");
      } else if (error.code === "INVALID_OTP") {
        setError("Kod hatalı.");
      } else if (error.code === "OTP_EXPIRED") {
        setError("Kodun süresi dolmuş.");
      } else if (error.code === "TOO_MANY_ATTEMPTS") {
        setError("Çok fazla hatalı deneme yapıldı. Yeni kod isteyin.");
      } else if (error.code === "PASSWORD_TOO_SHORT") {
        setError("Şifre en az 8 karakter olmalı.");
      } else {
        setError("Şifre sıfırlanamadı. Lütfen tekrar deneyin.");
      }
      return;
    }
    Alert.alert("Şifreniz güncellendi", "Yeni şifrenizle giriş yapın.");
    onDone();
  }

  async function resend() {
    setError(null);
    setInfo(null);
    setResending(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({
      email,
    });
    setResending(false);
    if (error) {
      setError(
        error.status === 429
          ? "Çok fazla deneme. Lütfen bir dakika bekleyin."
          : "İstek gönderilemedi. Lütfen tekrar deneyin.",
      );
      return;
    }
    setOtp("");
    setInfo("Yeni kod gönderildi.");
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>
        Open<Text style={styles.brandAccent}>Gym</Text>
      </Text>
      <Text style={styles.sub}>
        {email} adresine gönderilen kodu ve yeni şifrenizi girin.
      </Text>
      <ErrorMsg text={error} />
      {info && (
        <Text style={{ color: colors.ok, marginBottom: 14, fontSize: 13 }}>
          {info}
        </Text>
      )}
      <Field label="E-posta" value={email} editable={false} />
      <Field
        label="Doğrulama kodu"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
      />
      <Field
        label="Yeni şifre (min. 8 karakter)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <Field
        label="Yeni şifre (tekrar)"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
      />
      <Button title="Şifreyi sıfırla" onPress={submit} busy={busy} />
      <Pressable onPress={() => void resend()} disabled={resending}>
        <Text style={styles.link}>
          {resending ? "Kod gönderiliyor..." : "Kodu tekrar gönder"}
        </Text>
      </Pressable>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>Giriş ekranına dön</Text>
      </Pressable>
    </View>
  );
}
