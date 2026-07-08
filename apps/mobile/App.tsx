import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { authClient } from "./src/lib/auth";
import { colors } from "./src/theme";
import { Login } from "./src/screens/Login";
import { Register } from "./src/screens/Register";
import { VerifyOtp } from "./src/screens/VerifyOtp";
import { Home } from "./src/screens/Home";
import { QrEntry } from "./src/screens/QrEntry";

type Screen =
  | { name: "login" }
  | { name: "register" }
  | { name: "verify"; email: string; password: string };

type HomeSubScreen = "home" | "qr";

export default function App() {
  const { data: session, isPending } = authClient.useSession();
  const [screen, setScreen] = useState<Screen>({ name: "login" });
  const [homeScreen, setHomeScreen] = useState<HomeSubScreen>("home");

  useEffect(() => {
    if (!session) setHomeScreen("home");
  }, [session]);

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
        <QrEntry onBack={() => setHomeScreen("home")} />
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
  } else {
    body = (
      <Login
        onRegister={() => setScreen({ name: "register" })}
        onNeedsVerification={(email, password) =>
          setScreen({ name: "verify", email, password })
        }
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
