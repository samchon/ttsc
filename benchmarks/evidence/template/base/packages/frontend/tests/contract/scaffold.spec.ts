import { expect, test, type Page } from "@playwright/test";

/**
 * Loads the application against the simulated client and returns nothing.
 *
 * The guards live here rather than in the `test` callback because
 * `playwright/no-conditional-in-test` reports any branch inside one, and the
 * journey specs use the same shape for the same reason.
 */
export async function contract_scaffold_renders(page: Page): Promise<void> {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const response = await page.goto("/");
  if (response === null) throw new Error("Navigation returned no response.");
  if (response.ok() === false)
    throw new Error(`Navigation failed with status ${response.status()}.`);
  if (failures.length !== 0)
    throw new Error(`The page raised ${failures.join("; ")}.`);
}

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
  await contract_scaffold_renders(page);
  await expect(page.locator("main")).toBeVisible();
});
