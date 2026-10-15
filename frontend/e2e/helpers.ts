import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";

export interface CreatedLead {
  id: number;
  name: string;
}

/** Fails any test in which the page throws an uncaught error. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));
    await provide(page);
    expect(errors, "uncaught errors in the page").toEqual([]);
  },
});

export { expect };

/** Tests create their own leads so they can run in parallel without touching the demo data. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Math.random().toString(36).slice(2, 8)}`;
}

export async function createLead(
  request: APIRequestContext,
  data: { name: string; company?: string; phone?: string },
): Promise<CreatedLead> {
  const response = await request.post("/api/leads", { data });
  expect(response.status()).toBe(201);
  return response.json();
}

export async function addNote(
  request: APIRequestContext,
  leadId: number,
  body: string,
  followUpAt?: Date,
): Promise<void> {
  const response = await request.post(`/api/leads/${leadId}/discussions`, {
    data: { body, follow_up_at: followUpAt?.toISOString() },
  });
  expect(response.status()).toBe(201);
}

export const section = (page: Page, title: RegExp) => page.getByRole("region", { name: title });

export const leadCard = (page: Page, name: string) =>
  page.locator("article").filter({ has: page.getByRole("button", { name, exact: true }) });

export async function openLead(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: new RegExp(name) });
  await expect(dialog.getByRole("list", { name: /discussion history/i })).toBeVisible();
  return dialog;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Values for <input type="date"> and <input type="time"> in the browser's (local) timezone. */
export function dateTimeInputs(date: Date) {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}
