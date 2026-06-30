import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "screenshots");
const baseUrl = "https://staff-attendance-system-tau.vercel.app";

const shots = [
  { name: "01-auth", url: `${baseUrl}/auth`, waitFor: "text=Sign In" },
  { name: "02-terms", url: `${baseUrl}/terms`, waitFor: "h1" },
  { name: "03-privacy", url: `${baseUrl}/privacy`, waitFor: "h1" },
  { name: "04-dashboard", url: `${baseUrl}/dashboard`, auth: "admin", waitFor: "text=Dashboard" },
  { name: "05-my-attendance", url: `${baseUrl}/my-attendance`, auth: "staff", waitFor: "text=My Attendance" },
  { name: "06-settings", url: `${baseUrl}/settings`, auth: "admin", waitFor: "text=Settings" },
  { name: "07-staff", url: `${baseUrl}/staff`, auth: "admin", waitFor: "text=Staff" },
  { name: "08-leaves", url: `${baseUrl}/leaves`, auth: "admin", waitFor: "text=Leave" },
];

async function signIn(page, role) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const email = role === "admin" ? "admin@school.com" : "emily.chen@school.com";
  const password = role === "admin" ? "Admin1234!" : "Staff1234!";
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL(/dashboard|my-attendance/, { timeout: 90000 });
}

async function capture(page, shot) {
  await page.goto(shot.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (shot.waitFor) {
    await page.locator(shot.waitFor).first().waitFor({ timeout: 30000 });
  }
  await page.waitForTimeout(2000);
  const filePath = path.join(outDir, `${shot.name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log("Saved", filePath);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  let currentAuth = null;

  for (const shot of shots) {
    try {
      if (shot.auth && shot.auth !== currentAuth) {
        await signIn(page, shot.auth);
        currentAuth = shot.auth;
      }
      if (!shot.auth) {
        currentAuth = null;
      }
      await capture(page, shot);
    } catch (err) {
      console.warn("Skipped", shot.name, err.message);
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
