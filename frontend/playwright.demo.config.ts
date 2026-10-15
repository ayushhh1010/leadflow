import { defineConfig, devices } from "@playwright/test";

import base from "./playwright.config";

// Records docs/demo.webm and the README screenshots:  npm run demo:record
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "demo.spec.ts",
  retries: 0,
  reporter: "list",
  projects: [
    {
      name: "demo",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
        video: { mode: "on", size: { width: 1280, height: 800 } },
      },
    },
  ],
});
