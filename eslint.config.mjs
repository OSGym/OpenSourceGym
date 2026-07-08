import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // agents/: cihaz tarafı referans kodu (RPi/ESP32/sim), workspace dışı
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**", "agents/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
