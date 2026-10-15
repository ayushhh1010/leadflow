import path from "node:path";

import { devices, type Page } from "@playwright/test";

import { dateTimeInputs, expect, leadCard, openLead, section, test } from "./helpers";

// Not part of the test suite: walks through the main flows at a human pace and saves
// the demo video and README screenshots into docs/.
const DOCS = path.join(__dirname, "..", "..", "docs");
const shot = (name: string) => path.join(DOCS, "screenshots", `${name}.png`);

test.setTimeout(180_000);

/** Headless browsers draw no cursor, so show one in the recording. */
async function showCursor(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const dot = document.createElement("div");
      dot.id = "demo-cursor";
      dot.style.cssText =
        "position:fixed;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;" +
        "background:rgba(37,99,235,.35);border:2px solid #2563eb;pointer-events:none;transition:transform .15s;left:-50px;top:-50px";
      document.body.append(dot);
      document.addEventListener("mousemove", (event) => {
        dot.style.left = `${event.clientX}px`;
        dot.style.top = `${event.clientY}px`;
      });
      document.addEventListener("mousedown", () => (dot.style.transform = "scale(.6)"));
      document.addEventListener("mouseup", () => (dot.style.transform = ""));
    });
  });
}

const pause = (page: Page, ms = 1200) => page.waitForTimeout(ms);

/** Screenshot without the fake cursor in it. */
async function snap(page: Page, name: string) {
  const cursor = page.locator("#demo-cursor");
  await cursor.evaluate((dot) => (dot.style.visibility = "hidden"));
  await page.screenshot({ path: shot(name) });
  await cursor.evaluate((dot) => (dot.style.visibility = "visible"));
}

test("record the LeadFlow walkthrough", async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL;
  const desktop = { baseURL, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 };

  // Full-page screenshots briefly resize the viewport, so take this one before recording.
  const still = await browser.newContext(desktop);
  const listPage = await still.newPage();
  await listPage.goto("/");
  await expect(section(listPage, /^all leads/i)).toBeVisible();
  await listPage.screenshot({ path: shot("01-lead-list"), fullPage: true });
  await still.close();

  const recording = await browser.newContext({
    ...desktop,
    recordVideo: { dir: test.info().outputDir, size: desktop.viewport },
  });
  const page = await recording.newPage();
  await showCursor(page);
  await page.goto("/");
  await expect(section(page, /^all leads/i)).toBeVisible();
  await pause(page, 1500);

  // Filters and search.
  await page
    .locator("label")
    .filter({ hasText: /^Proposal Sent$/ })
    .click();
  await pause(page);
  await page.locator("label").filter({ hasText: /^All$/ }).click();
  const search = page.getByRole("searchbox", { name: /search leads/i });
  await search.pressSequentially("glob", { delay: 120 });
  await pause(page);
  await snap(page, "02-search");
  await search.clear();
  await pause(page, 800);

  // Log a discussion with a follow-up for later today: the lead gets pinned.
  const soon = new Date(Date.now() + 60 * 60_000);
  const followUp =
    soon.getDate() === new Date().getDate() ? soon : new Date(Date.now() + 86_400_000);
  const dialog = await openLead(page, "Bill Lumbergh");
  await pause(page);
  await dialog
    .getByRole("textbox", { name: "New discussion note" })
    .pressSequentially("Spoke with Bill. He wants a demo for his whole team this afternoon.", {
      delay: 25,
    });
  await dialog.getByRole("checkbox", { name: "Set follow-up" }).check();
  const { date, time } = dateTimeInputs(followUp);
  await dialog.getByLabel("Follow-up date").fill(date);
  await dialog.getByLabel("Follow-up time").fill(time);
  await pause(page, 800);
  await dialog.getByRole("button", { name: "Save note" }).click();
  await expect(dialog.getByRole("listitem").first()).toContainText("Spoke with Bill");
  await pause(page, 1500);
  await page.mouse.move(640, 320);
  await snap(page, "03-timeline");
  await page.keyboard.press("Escape");
  await expect(leadCard(page, "Bill Lumbergh")).toContainText("Spoke with Bill");
  await pause(page, 1800);

  // Move a deal forward and close its follow-up.
  const sarah = await openLead(page, "Sarah Connor");
  await pause(page);
  await sarah.getByLabel("Status").selectOption("won");
  await expect(sarah.getByRole("listitem").first()).toContainText("to Won");
  await pause(page);
  await sarah.getByRole("button", { name: "Mark done" }).click();
  await expect(sarah.getByRole("listitem").first()).toContainText("Follow-up cleared");
  await pause(page, 1500);
  await page.keyboard.press("Escape");
  await pause(page);

  // Add a new lead.
  await page.getByRole("button", { name: "Add new lead" }).click();
  const add = page.getByRole("dialog", { name: "Add new lead" });
  await add.getByLabel("Full name").pressSequentially("Peter Gibbons", { delay: 60 });
  await add.getByLabel(/^Company/).pressSequentially("Initech", { delay: 60 });
  await add.getByLabel(/^Phone/).pressSequentially("555-0144", { delay: 60 });
  await pause(page, 600);
  await snap(page, "04-add-lead");
  await add.getByRole("button", { name: "Save lead" }).click();
  await expect(leadCard(page, "Peter Gibbons")).toBeVisible();
  await pause(page, 2000);

  const video = page.video();
  await recording.close();
  await video?.saveAs(path.join(DOCS, "demo.webm"));

  // Phone-sized screenshots.
  const phone = await browser.newContext({
    ...devices["iPhone 15"],
    baseURL,
    reducedMotion: "reduce",
  });
  const mobile = await phone.newPage();
  await mobile.goto("/");
  await expect(section(mobile, /^all leads/i)).toBeVisible();
  await mobile.screenshot({ path: shot("05-mobile-list") });
  await openLead(mobile, "Ellen Ripley");
  await mobile.screenshot({ path: shot("06-mobile-timeline") });
  await phone.close();
});
