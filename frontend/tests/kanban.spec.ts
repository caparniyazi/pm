import { expect, test, type Page } from "@playwright/test";

const signIn = async (page: Page) => {
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
};

// The board is backed by a persistent SQLite database, so every mutating test
// resets it to a known state first to stay independent of earlier runs.
const seedBoard = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Align roadmap themes", details: "Seed." },
    "card-2": { id: "card-2", title: "Gather customer signals", details: "Seed." },
    "card-3": { id: "card-3", title: "Prototype analytics view", details: "Seed." },
    "card-4": { id: "card-4", title: "Refine status language", details: "Seed." },
    "card-5": { id: "card-5", title: "Design card layout", details: "Seed." },
    "card-6": { id: "card-6", title: "QA micro-interactions", details: "Seed." },
    "card-7": { id: "card-7", title: "Ship marketing page", details: "Seed." },
    "card-8": { id: "card-8", title: "Close onboarding sprint", details: "Seed." },
  },
};

const loginAndGetToken = async (page: Page): Promise<string> => {
  const response = await page.request.post("/api/auth/login", {
    data: { username: "user", password: "password" },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.token as string;
};

const resetBoard = async (page: Page) => {
  const token = await loginAndGetToken(page);
  const boardsResponse = await page.request.get("/api/boards", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(boardsResponse.ok()).toBeTruthy();
  const boards = await boardsResponse.json();
  const boardId = boards[0].id as string;

  const response = await page.request.put(`/api/boards/${boardId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: seedBoard,
  });
  expect(response.ok()).toBeTruthy();
};

test("rejects invalid credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "Invalid username or password" });
  await expect(alert).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to Kanban Studio" })).toBeVisible();
});

test("persists login and supports logout", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to Kanban Studio" })).toBeVisible();
});

test("loads the kanban board", async ({ page }) => {
  await page.goto("/");
  await resetBoard(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await page.goto("/");
  await resetBoard(page);
  await signIn(page);
  const title = `Playwright card ${Date.now()}`;
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(title);
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText(title)).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await page.goto("/");
  await resetBoard(page);
  await signIn(page);

  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  await expect(card).toBeVisible();

  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  const startX = cardBox.x + cardBox.width / 2;
  const startY = cardBox.y + cardBox.height / 2;
  const endX = columnBox.x + columnBox.width / 2;
  const endY = columnBox.y + columnBox.height / 2;

  // dnd-kit's PointerSensor needs an activation nudge past 6px and then a few
  // incremental moves, each given a frame to register, before the drop.
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 8, startY + 8, { steps: 5 });
  await page.waitForTimeout(50);
  await page.mouse.move(endX, endY, { steps: 25 });
  await page.waitForTimeout(50);
  await page.mouse.move(endX, endY + 4, { steps: 5 });
  await page.waitForTimeout(50);
  await page.mouse.up();

  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
  await expect(
    page.getByTestId("column-col-backlog").getByTestId("card-card-1")
  ).toHaveCount(0);
});

test("registers a new account and lands on a private empty board", async ({ page }) => {
  const username = `pw-user-${Date.now()}`;

  await page.goto("/");
  await page.getByRole("button", { name: "Need an account? Create one" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "My Board" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  await expect(page.getByText("Align roadmap themes")).toHaveCount(0);
});

test("creates, switches between, and deletes boards", async ({ page }) => {
  await page.goto("/");
  await resetBoard(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();

  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("New board name").fill("Second Board");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Second Board" })).toBeVisible();
  await expect(page.getByText("Align roadmap themes")).toHaveCount(0);

  await page.getByRole("button", { name: "Kanban Studio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.getByText("Align roadmap themes")).toBeVisible();

  await page.getByRole("button", { name: "Second Board", exact: true }).hover();
  await page.getByRole("button", { name: "Delete Second Board" }).click();
  await expect(page.getByRole("button", { name: "Second Board", exact: true })).toHaveCount(0);
});
