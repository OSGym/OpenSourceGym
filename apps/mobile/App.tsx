import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { authClient } from "./src/lib/auth";
import { colors } from "./src/theme";
import { Login } from "./src/screens/Login";
import { Register } from "./src/screens/Register";
import { VerifyOtp } from "./src/screens/VerifyOtp";
import { Home } from "./src/screens/Home";

type Screen =
  | { name: "login" }
  | { name: "register" }
  | { name: "verify"; email: string; password: string };

export default function App() {
  const { data: session, isPending } = authClient.useSession();
  const [screen, setScreen] = useState<Screen>({ name: "login" });

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
    body = <Home userName={session.user.name} />;
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
