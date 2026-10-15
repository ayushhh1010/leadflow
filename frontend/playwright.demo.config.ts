import { defineConfig, devices } from "@playwright/test";

import base from "./playwright.config";

// Records docs/demo.webm and the README screenshots:  npm run demo:record
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "demo.spec.ts",
  retries: 0,
  reporter: "list",
  // The spec creates its own contexts (screenshot first, then the recording).
  projects: [{ name: "demo", use: { ...devices["Desktop Chrome"] } }],
});
