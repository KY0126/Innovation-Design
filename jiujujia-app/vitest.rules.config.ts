import { defineConfig } from "vitest/config";

// Security rules tests need the Firestore emulator: run via `npm run test:rules`.
export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
