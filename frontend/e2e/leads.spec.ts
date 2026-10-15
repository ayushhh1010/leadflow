import {
  addNote,
  createLead,
  dateTimeInputs,
  expect,
  leadCard,
  openLead,
  section,
  test,
  uniqueName,
} from "./helpers";

const DAY = 86_400_000;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(section(page, /^all leads/i)).toBeVisible();
});

test.describe("lead list", () => {
  test("shows name, status, last note and time since the last discussion", async ({ page }) => {
    const hank = leadCard(page, "Hank Scorpio");

    await expect(hank).toContainText("(Globex)");
    await expect(hank.getByText("New", { exact: true })).toBeVisible();
    await expect(hank).toContainText("Last note: Inbound lead from website contact form.");
    await expect(hank).toContainText(/\d+ hours? ago/);
    await expect(leadCard(page, "Leslie Knope")).toContainText("No discussions yet");
  });

  test("pins overdue and today's follow-ups above all other leads", async ({ page }) => {
    const overdue = section(page, /^overdue follow-ups/i);
    const today = section(page, /^today's follow-ups/i);
    const all = section(page, /^all leads/i);

    await expect(overdue.getByRole("button", { name: "Gavin Belson" })).toBeVisible();
    await expect(leadCard(page, "Gavin Belson")).toContainText("Overdue ·");
    await expect(today.getByRole("button", { name: "Sarah Connor" })).toBeVisible();
    await expect(today.getByRole("button", { name: "Ellen Ripley" })).toBeVisible();
    await expect(all.getByRole("button", { name: "Bill Lumbergh" })).toBeVisible();
    await expect(all.getByRole("button", { name: "Sarah Connor" })).toHaveCount(0);

    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings.map((text) => text.replace(/\d+$/, ""))).toEqual([
      "Overdue follow-ups",
      "Today's follow-ups",
      "All leads",
    ]);
  });

  test("filters by status and searches by name or company", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: /search leads/i });
    const matching = section(page, /^matching leads/i);

    await page.locator("label").filter({ hasText: /^Won$/ }).click();
    await expect(page.getByRole("radio", { name: "Won" })).toBeChecked();
    await expect(matching.getByRole("button")).toHaveText(["Bruce Wayne"]);

    await page.locator("label").filter({ hasText: /^All$/ }).click();
    await search.fill("GLOBEX");
    await expect(matching.getByRole("button")).toHaveText(["Hank Scorpio"]);

    await search.fill("no such lead");
    await expect(page.getByText("No leads match your filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(search).toHaveValue("");
    await expect(section(page, /^all leads/i)).toBeVisible();
  });

  test("shows a recoverable error when the API is unavailable", async ({ page }) => {
    await page.route("**/api/leads", (route) =>
      route.fulfill({ status: 503, body: "Unavailable" }),
    );
    await page.reload();

    // Scoped to <main>: Next.js adds its own role="alert" route announcer.
    await expect(page.getByRole("main").getByRole("alert")).toContainText("isn't responding");

    await page.unroute("**/api/leads");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(section(page, /^all leads/i)).toBeVisible();
  });

  test("never scrolls sideways", async ({ page }) => {
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

    expect(await overflow()).toBeLessThanOrEqual(0);
    await openLead(page, "Sarah Connor");
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});

test.describe("lead timeline", () => {
  test("lists every discussion newest first", async ({ page }) => {
    const dialog = await openLead(page, "Sarah Connor");
    const entries = dialog.getByRole("list", { name: /discussion history/i }).getByRole("listitem");

    await expect(entries).toHaveText([
      /Sent pricing tier PDF/,
      /Status changed from Qualified to Proposal Sent/,
      /Initial discovery call/,
      /Lead created via web form/,
    ]);
    await expect(entries.first()).toContainText("Follow-up set for");
  });

  test("a note with a follow-up for later today pins the lead immediately", async ({
    page,
    request,
  }) => {
    const soon = new Date(Date.now() + 10 * 60_000);
    test.skip(
      soon.getDate() !== new Date().getDate(),
      "too close to midnight for a 'today' follow-up",
    );
    const lead = await createLead(request, { name: uniqueName("Pinned"), company: "E2E Co" });
    await page.reload();

    const dialog = await openLead(page, lead.name);
    const { date, time } = dateTimeInputs(soon);
    await dialog.getByRole("textbox", { name: "New discussion note" }).fill("Demo booked.");
    await dialog.getByRole("checkbox", { name: "Set follow-up" }).check();
    await dialog.getByLabel("Follow-up date").fill(date);
    await dialog.getByLabel("Follow-up time").fill(time);
    await dialog.getByRole("button", { name: "Save note" }).click();

    await expect(dialog.getByRole("listitem").first()).toContainText("Demo booked.");
    await expect(dialog.getByRole("textbox", { name: "New discussion note" })).toHaveValue("");
    // The list behind the dialog updated from the same response.
    const today = section(page, /^today's follow-ups/i);
    await expect(today.getByRole("button", { name: lead.name })).toBeAttached();

    await page.keyboard.press("Escape");
    await expect(leadCard(page, lead.name)).toContainText("Last note: Demo booked.");
    await expect(leadCard(page, lead.name)).toContainText("Follow-up today at");
  });

  test("status changes persist", async ({ page, request }) => {
    const lead = await createLead(request, { name: uniqueName("Status") });
    await page.reload();

    const dialog = await openLead(page, lead.name);
    await dialog.getByLabel("Status").selectOption("qualified");
    await expect(dialog.getByRole("listitem").first()).toContainText(
      "Status changed from New to Qualified",
    );

    await page.keyboard.press("Escape");
    await page.reload();
    await expect(leadCard(page, lead.name).getByText("Qualified", { exact: true })).toBeVisible();
  });

  test("marking a follow-up done clears it", async ({ page, request }) => {
    const lead = await createLead(request, { name: uniqueName("Callback") });
    await addNote(request, lead.id, "Asked us to call back.", new Date(Date.now() + 3 * DAY));
    await page.reload();

    const dialog = await openLead(page, lead.name);
    await dialog.getByRole("button", { name: "Mark done" }).click();

    await expect(dialog.getByRole("button", { name: "Mark done" })).toBeHidden();
    await expect(dialog.getByRole("listitem").first()).toContainText("Follow-up cleared");
    await page.keyboard.press("Escape");
    await expect(leadCard(page, lead.name)).not.toContainText("Follow-up");
  });

  test("works from the keyboard and keeps unsaved notes", async ({ page }) => {
    const opener = page.getByRole("button", { name: "Hank Scorpio", exact: true });
    await opener.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: /Hank Scorpio/ });
    const note = dialog.getByRole("textbox", { name: "New discussion note" });
    await expect(note).toBeFocused();
    await note.fill("Half-written thought");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(note).toHaveValue("Half-written thought");
  });
});

test.describe("add lead", () => {
  test("validates, saves and shows the new lead", async ({ page }) => {
    await page.locator("label").filter({ hasText: /^Won$/ }).click();
    // Opened from the keyboard: Safari doesn't focus buttons on click, so there would be
    // nothing to return focus to (mouse users don't need it).
    const addButton = page.getByRole("button", { name: "Add new lead" });
    await addButton.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Add new lead" });
    const nameField = dialog.getByLabel("Full name");
    await expect(nameField).toBeFocused();
    await dialog.getByRole("button", { name: "Save lead" }).click();
    await expect(dialog.getByText("Enter the lead's name.")).toBeVisible();

    const name = uniqueName("Peter Gibbons");
    await nameField.fill(name);
    await dialog.getByLabel(/^Company/).fill("Initech");
    await dialog.getByLabel(/^Phone/).fill("call me");
    await dialog.getByRole("button", { name: "Save lead" }).click();
    await expect(dialog.getByLabel(/^Phone/)).toHaveAttribute("aria-invalid", "true");

    await dialog.getByLabel(/^Phone/).fill("555-0144");
    await dialog.getByRole("button", { name: "Save lead" }).click();

    await expect(dialog).toBeHidden();
    await expect(addButton).toBeFocused();
    await expect(page.getByRole("radio", { name: "All" })).toBeChecked();
    const card = leadCard(page, name);
    await expect(card).toContainText("(Initech)");
    await expect(card.getByText("New", { exact: true })).toBeVisible();
    await expect(card).toContainText("No discussions yet");
  });
});
