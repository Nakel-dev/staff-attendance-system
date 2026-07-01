import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || "https://staff-attendance-system-tau.vercel.app",
    trace: "on-first-retry",
  },
});
