import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fieldAppRoot = path.join(__dirname, "apps/field-app");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.join(fieldAppRoot, "node_modules/react"),
      "react-dom": path.join(fieldAppRoot, "node_modules/react-dom"),
    },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["**/apps/field-app/**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "apps/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.tsx",
      "packages/*/src/**/*.test.ts",
      "packages/*/src/**/*.test.tsx",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    passWithNoTests: false,
  },
});
