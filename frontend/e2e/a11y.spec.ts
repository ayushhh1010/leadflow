import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, openLead, section, test } from "./helpers";

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(section(page, /^all leads/i)).toBeVisible();
});

test("lead list meets WCAG 2.2 AA checks", async ({ page }) => {
  expect(await violations(page)).toEqual([]);
});

test("timeline dialog meets WCAG 2.2 AA checks", async ({ page }) => {
  await openLead(page, "Sarah Connor");
  expect(await violations(page)).toEqual([]);
});

test("add-lead dialog with errors meets WCAG 2.2 AA checks", async ({ page }) => {
  await page.getByRole("button", { name: "Add new lead" }).click();
  const dialog = page.getByRole("dialog", { name: "Add new lead" });
  await dialog.getByRole("button", { name: "Save lead" }).click();
  await expect(dialog.getByText("Enter the lead's name.")).toBeVisible();

  expect(await violations(page)).toEqual([]);
});
