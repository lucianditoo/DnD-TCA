import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.jsx"],
    coverage: {
      include: ["src/components/ActionsPanel/ActionsPanel.tsx", "src/pages/ProfilesPage.tsx"],
      reportsDirectory: "../../coverage/web",
    },
  },
});
