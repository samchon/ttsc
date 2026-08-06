import { expect, test } from "@playwright/test";

/**
 * The contract pass runs against `VITE_API_SIMULATE=true`, where the generated
 * SDK answers with `typia.random`. A value is type-correct and otherwise
 * arbitrary, so this suite may assert that a screen reaches its typed client
 * boundary and renders, and nothing about what the data means. Every assertion
 * on a concrete effect belongs in `tests/journeys/`, which runs live.
 */
test("the application renders against the simulated client", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));

  const response = await page.goto("/");
  if (response === null) throw new Error("Navigation returned no response.");
  expect(response.ok()).toBe(true);
  await expect(page.locator("main")).toBeVisible();
  expect(failures).toEqual([]);
});
