import { useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { authClient } from "../lib/auth";
import { Button, Checkbox, ErrorMsg, Field, styles } from "../ui";

export function Register({
  onLogin,
  onRegistered,
}: {
  onLogin: () => void;
  onRegistered: (email: string, password: string) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!firstName || !lastName || !phone || !email || !password) {
      setError("Tüm alanları doldurun.");
      return;
    }
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalı.");
      return;
    }
    if (!kvkk || !privacy) {
      setError(
        "KVKK aydınlatma metni ve gizlilik sözleşmesi onayları zorunludur.",
      );
      return;
    }
    setBusy(true);
    const { error } = await authClient.signUp.email({
      name: `${firstName} ${lastName}`,
      email,
      password,
      // @ts-expect-error ek alanlar sunucu şemasında tanımlı
      firstName,
      lastName,
      phone,
      kvkkAccepted: kvkk,
      privacyAccepted: privacy,
    });
    setBusy(false);
    if (error) {
      const message = error.message ?? "";
      const normalizedMessage = message.toLocaleLowerCase("tr-TR");
      const duplicatePhone =
        error.code === "PHONE_ALREADY_EXISTS" ||
        (normalizedMessage.includes("telefon") &&
          (normalizedMessage.includes("kayıtlı") ||
            normalizedMessage.includes("kullanılıyor")));

      if (duplicatePhone) {
        setError("Bu telefon numarası ile kayıtlı hesap var.");
      } else if (
        error.code === "USER_ALREADY_EXISTS" ||
        error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
      ) {
        setError("Bu e-posta ile kayıtlı hesap var.");
      } else {
        setError(message || "Kayıt başarısız.");
      }
      return;
    }
    onRegistered(email, password);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: styles.screen.backgroundColor }}
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
    >
      <Text style={styles.brand}>
        Open<Text style={styles.brandAccent}>Gym</Text>
      </Text>
      <Text style={styles.sub}>Üye kaydı</Text>
      <ErrorMsg text={error} />
      <Field label="İsim" value={firstName} onChangeText={setFirstName} />
      <Field label="Soyisim" value={lastName} onChangeText={setLastName} />
      <Field
        label="Telefon numarası"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+905xxxxxxxxx"
      />
      <Field
        label="E-posta"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Şifre (min. 8 karakter)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Checkbox
        checked={kvkk}
        onToggle={() => setKvkk(!kvkk)}
        label="KVKK aydınlatma metnini okudum, kişisel verilerimin işlenmesini onaylıyorum."
      />
      <Checkbox
        checked={privacy}
        onToggle={() => setPrivacy(!privacy)}
        label="Gizlilik sözleşmesini okudum ve kabul ediyorum."
      />
      <Button title="Kayıt ol" onPress={submit} busy={busy} />
      <Pressable onPress={onLogin}>
        <Text style={styles.link}>Zaten hesabın var mı? Giriş yap</Text>
      </Pressable>
    </ScrollView>
  );
}
