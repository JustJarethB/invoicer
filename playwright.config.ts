import { defineConfig, devices } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * Playwright 1.55+ bundles Chromium 140, which is built for macOS 12+ and
 * crashes on macOS 11 Big Sur with a dyld CATapDescription error.
 *
 * On those machines we fall back to the locally installed Google Chrome channel
 * (if available). CI runs ubuntu-latest so it keeps using the bundled Chromium.
 */
function needsChromeChannel(): boolean {
  if (process.platform !== "darwin") return false;
  try {
    const version = execSync("sw_vers -productVersion", { encoding: "utf8" }).trim();
    const major = Number(version.split(".")[0]);
    return major === 11;
  } catch {
    return false;
  }
}

function chromeChannel() {
  if (!needsChromeChannel()) return undefined;

  try {
    const chromePath = process.env.PLAYWRIGHT_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    execSync(`"${chromePath}" --version`, { stdio: "ignore" });
    return { channel: "chrome" as const, launchOptions: { executablePath: chromePath } };
  } catch {
    throw new Error(
      "macOS 11 detected: Playwright’s bundled Chromium requires macOS 12+. " +
        "Please install Google Chrome, or set PLAYWRIGHT_CHROME_PATH to a compatible Chromium executable."
    );
  }
}

const chrome = chromeChannel();

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-chromium-{platform}{ext}",
  /* Run tests serially within files so snapshots and shared localStorage stay deterministic. */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Increase timeout to account for the Vite dev server cold start. */
  timeout: 60_000,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["html", { open: "never" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:5173",
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    /* Use the installed Chrome channel on macOS 11 Big Sur. */
    channel: chrome?.channel,
    launchOptions: chrome?.launchOptions,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["**/e2e/flows/**/*.spec.ts"],
    },

    {
      name: "visual-regression",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["**/e2e/snapshots/**/*.spec.ts"],
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
