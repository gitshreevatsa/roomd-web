import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Modules that read these at import time (lib/collab, lib/crypto) need them
    // set before the first import, so they live here rather than in a test body.
    env: {
      ROOMD_URL: "http://roomd.test",
      NEXTAUTH_SECRET: "test-secret-not-used-in-production",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
