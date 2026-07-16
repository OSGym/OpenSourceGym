import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { authClient } from "./src/lib/auth";
import {
  checkDeviceIntegrity,
  type DeviceIntegrityResult,
} from "./src/lib/deviceIntegrity";
import { colors, motion, spacing, type } from "./src/theme";
import {
  Button,
  LogoMark,
  Screen,
  StatusMessage,
  useReducedMotion,
} from "./src/ui";
import { Login } from "./src/screens/Login";
import { Register } from "./src/screens/Register";
import { VerifyOtp } from "./src/screens/VerifyOtp";
import { ForgotPassword } from "./src/screens/ForgotPassword";
import { ResetPassword } from "./src/screens/ResetPassword";
import { Home } from "./src/screens/Home";
import { GateScan } from "./src/screens/GateScan";
import { Profile } from "./src/screens/Profile";
import { BottomTabBar, type AppTab } from "./src/components/BottomTabBar";
import { LanguageSwitcher } from "./src/i18n/LanguageSwitcher";
import { initializeLocalization, syncDeviceLanguage } from "./src/i18n";

type ScreenState =
  | { name: "login" }
  | { name: "register" }
  | { name: "verify"; email: string; password: string }
  | { name: "forgot" }
  | { name: "reset"; email: string };

function DeviceBlocked({ onHome }: { onHome: () => void }) {
  const { t } = useTranslation();

  return (
    <Screen style={{ justifyContent: "center" }}>
      <LogoMark />
      <Text
        style={{
          ...type.sectionTitle,
          color: colors.textPrimary,
          marginTop: spacing.xl,
        }}
      >
        {t("Bu cihazda QR kullanılamıyor")}
      </Text>
      <Text
        style={{
          ...type.body,
          color: colors.textSecondary,
          marginTop: spacing.sm,
        }}
      >
        {t(
          "Cihazınızda güvenlik riski tespit edildi (root/jailbreak veya hata ayıklama). Güvenlik nedeniyle QR ile giriş bu cihazda kullanılamaz.",
        )}
      </Text>
      <StatusMessage
        tone="warning"
        text={t("Yardım için salon resepsiyonuna başvurun.")}
      />
      <View style={{ marginTop: spacing.xl }}>
        <Button title={t("Ana sayfaya dön")} onPress={onHome} />
      </View>
    </Screen>
  );
}

function SignedInApp({
  userName,
  integrity,
}: {
  userName: string;
  integrity: DeviceIntegrityResult | null;
}) {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [profileVisited, setProfileVisited] = useState(false);
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (activeTab === "profile") setProfileVisited(true);
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.72);
    Animated.timing(opacity, {
      toValue: 1,
      duration: motion.standard,
      useNativeDriver: true,
    }).start();
  }, [activeTab, opacity, reducedMotion]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={{ flex: 1, opacity }}>
        <View style={activeTab === "home" ? styles.visible : styles.hidden}>
          <Home userName={userName} onOpenQr={() => setActiveTab("scan")} />
        </View>
        {activeTab === "scan" ? (
          integrity === null ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.textPrimary} size="large" />
            </View>
          ) : integrity.compromised ? (
            <DeviceBlocked onHome={() => setActiveTab("home")} />
          ) : (
            <GateScan />
          )
        ) : null}
        {profileVisited ? (
          <View
            style={activeTab === "profile" ? styles.visible : styles.hidden}
          >
            <Profile fallbackName={userName} />
          </View>
        ) : null}
      </Animated.View>
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );
}

function AppContent() {
  const { data: session, isPending } = authClient.useSession();
  const [localizationReady, setLocalizationReady] = useState(false);
  const [screen, setScreen] = useState<ScreenState>({ name: "login" });
  const [integrity, setIntegrity] = useState<DeviceIntegrityResult | null>(
    null,
  );
  const hadSession = useRef(false);

  useEffect(() => {
    void initializeLocalization().then(() => setLocalizationReady(true));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncDeviceLanguage();
    });
    return () => subscription.remove();
  }, []);

  const resetToLogin = useCallback(() => {
    setScreen({ name: "login" });
  }, []);

  useEffect(() => {
    if (session) {
      hadSession.current = true;
      return;
    }
    if (hadSession.current) {
      hadSession.current = false;
      resetToLogin();
    }
  }, [resetToLogin, session]);

  useEffect(() => {
    void checkDeviceIntegrity().then(setIntegrity);
  }, []);

  let body: React.ReactNode;
  if (!localizationReady || isPending) {
    body = (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.textPrimary} size="large" />
      </View>
    );
  } else if (session) {
    body = <SignedInApp userName={session.user.name} integrity={integrity} />;
  } else if (screen.name === "register") {
    body = (
      <Register
        onLogin={resetToLogin}
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
        onBack={resetToLogin}
        onVerified={resetToLogin}
      />
    );
  } else if (screen.name === "forgot") {
    body = (
      <ForgotPassword
        onBack={resetToLogin}
        onSent={(email) => setScreen({ name: "reset", email })}
      />
    );
  } else if (screen.name === "reset") {
    body = (
      <ResetPassword
        email={screen.email}
        onBack={resetToLogin}
        onDone={resetToLogin}
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
    <View style={styles.root}>
      <StatusBar style="light" />
      {body}
      {localizationReady && !session ? <LanguageSwitcher floating /> : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = {
  root: { flex: 1, backgroundColor: colors.background },
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  visible: { flex: 1 },
  hidden: { display: "none" as const },
};
