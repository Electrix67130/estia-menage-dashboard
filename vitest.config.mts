import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Fuseau fixe : les libellés de date/heure testés (formatDateFr, ymdLocal…)
// doivent être identiques sur le poste de chacun et en CI.
process.env.TZ = "Europe/Paris";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    env: { TZ: "Europe/Paris" },
    // Les mocks ne doivent pas fuir d'un test à l'autre (le localStorage est
    // vidé dans le setup).
    clearMocks: true,
    restoreMocks: true,
  },
});
