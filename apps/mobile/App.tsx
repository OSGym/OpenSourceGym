import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { authClient } from "./src/lib/auth";
import {
  checkDeviceIntegrity,
  type DeviceIntegrityResult,
} from "./src/lib/deviceIntegrity";
import { colors } from "./src/theme";
import { Button, styles } from "./src/ui";
import { Login } from "./src/screens/Login";
import { Register } from "./src/screens/Register";
import { VerifyOtp } from "./src/screens/VerifyOtp";
import { ForgotPassword } from "./src/screens/ForgotPassword";
import { ResetPassword } from "./src/screens/ResetPassword";
import { Home } from "./src/screens/Home";
import { QrEntry } from "./src/screens/QrEntry";

type Screen =
  | { name: "login" }
  | { name: "register" }
  | { name: "verify"; email: string; password: string }
  | { name: "forgot" }
  | { name: "reset"; email: string };

type HomeSubScreen = "home" | "qr";

function DeviceBlocked({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>
        Open<Text style={styles.brandAccent}>Gym</Text>
      </Text>
      <Text style={styles.error}>
        Cihazınızda güvenlik riski tespit edildi (root/jailbreak veya hata
        ayıklama). Güvenlik nedeniyle QR ile giriş bu cihazda kullanılamaz.
      </Text>
      <Button title="Geri" ghost onPress={onBack} />
    </View>
  );
}

export default function App() {
  const { data: session, isPending } = authClient.useSession();
  const [screen, setScreen] = useState<Screen>({ name: "login" });
  const [homeScreen, setHomeScreen] = useState<HomeSubScreen>("home");
  const [integrity, setIntegrity] = useState<DeviceIntegrityResult | null>(
    null,
  );

  useEffect(() => {
    if (!session) setHomeScreen("home");
  }, [session]);

  useEffect(() => {
    void checkDeviceIntegrity().then(setIntegrity);
  }, []);

  let body: React.ReactNode;
  if (isPending) {
    body = (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  } else if (session) {
    body =
      homeScreen === "qr" ? (
        integrity?.compromised ? (
          <DeviceBlocked onBack={() => setHomeScreen("home")} />
        ) : (
          <QrEntry onBack={() => setHomeScreen("home")} />
        )
      ) : (
        <Home
          userName={session.user.name}
          onOpenQr={() => setHomeScreen("qr")}
        />
      );
  } else if (screen.name === "register") {
    body = (
      <Register
        onLogin={() => setScreen({ name: "login" })}
        onRegistered={(email, password) =>
          setScreen({ name: "verify", email, password })
        }
      />
    );
  } else if (screen.name === "verify") {
    body = (
      <VerifyOtp
        email={screen.email}
        password={screen.password}
        onBack={() => setScreen({ name: "login" })}
      />
    );
  } else if (screen.name === "forgot") {
    body = (
      <ForgotPassword
        onBack={() => setScreen({ name: "login" })}
        onSent={(email) => setScreen({ name: "reset", email })}
      />
    );
  } else if (screen.name === "reset") {
    body = (
      <ResetPassword
        email={screen.email}
        onBack={() => setScreen({ name: "login" })}
        onDone={() => setScreen({ name: "login" })}
      />
    );
  } else {
    body = (
      <Login
        onRegister={() => setScreen({ name: "register" })}
        onNeedsVerification={(email, password) =>
          setScreen({ name: "verify", email, password })
        }
        onForgot={() => setScreen({ name: "forgot" })}
      />
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {body}
    </>
  );
}
