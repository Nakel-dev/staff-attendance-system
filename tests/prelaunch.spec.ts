/**
 * Pre-launch smoke tests — run with: npx playwright test tests/prelaunch.spec.ts
 * Set BASE_URL (default production) and optional STAFF_EMAIL / STAFF_PASSWORD.
 */
import { test, expect } from "@playwright/test";

const BASE_URL =
  process.env.BASE_URL || "https://staff-attendance-system-tau.vercel.app";
const STAFF_EMAIL = process.env.STAFF_EMAIL || "emily.chen@school.com";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || "Staff1234!";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@school.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin1234!";

test.describe("2. Staff Dashboard", () => {
  test("login with correct credentials loads dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.getByLabel("Email").fill(STAFF_EMAIL);
    await page.getByLabel("Password").fill(STAFF_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/my-attendance/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "My Attendance", level: 2 })).toBeVisible();
  });

  test("login with wrong password shows error without email leak", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.getByLabel("Email").fill(STAFF_EMAIL);
    await page.getByLabel("Password").fill("WrongPassword999!");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText(/wrong credentials|invalid login/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/email exists|user not found|no account/i)).not.toBeVisible();
  });

  test("logout redirects to login without manual refresh", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.getByLabel("Email").fill(STAFF_EMAIL);
    await page.getByLabel("Password").fill(STAFF_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/my-attendance/, { timeout: 20000 });

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/auth/, { timeout: 15000 });
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();

    await page.goto(`${BASE_URL}/my-attendance`);
    await expect(page).toHaveURL(/\/auth/, { timeout: 15000 });
  });

  test("profile page loads content for staff", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.getByLabel("Email").fill(STAFF_EMAIL);
    await page.getByLabel("Password").fill(STAFF_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/my-attendance/, { timeout: 20000 });

    await page.goto(`${BASE_URL}/profile`);
    await expect(page).toHaveURL(/\/profile/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "My Profile", level: 2 })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("heading", { name: "Face registration" })).toBeVisible();
  });
});

test.describe("3. Kiosk Authentication", () => {
  test("kiosk API rejects unauthenticated clock request", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/kiosk/clock`, {
      data: { staffId: "00000000-0000-0000-0000-000000000001" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(401);
  });

  test("kiosk session endpoint rejects without cookie", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/kiosk/session`);
    expect(res.status()).toBeGreaterThanOrEqual(401);
  });
});

test.describe("7. Data Integrity & Security", () => {
  test("staff cannot POST register-face without session", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/staff/register-face`, {
      data: { embeddings: [] },
    });
    expect(res.status()).toBeGreaterThanOrEqual(401);
  });

  test("rate limit returns 429 not 500 when hammering auth POST", async ({ request }) => {
    let saw429 = false;
    for (let i = 0; i < 35; i++) {
      const res = await request.post(`${BASE_URL}/auth`, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: "test=1",
      });
      if (res.status() === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBeTruthy();
  });
});

test.describe("Admin access", () => {
  test.skip(!process.env.RUN_ADMIN_TESTS, "Set RUN_ADMIN_TESTS=1 with valid admin credentials");

  test("admin login reaches dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 20000 });
  });
});
