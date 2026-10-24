import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8 resuelve los alias "@/*" de tsconfig.json sin plugin.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/features/**/schemas.ts"],
    },
  },
});
