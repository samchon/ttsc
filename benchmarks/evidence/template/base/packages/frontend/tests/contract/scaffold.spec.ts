import { expect, test, type Page } from "@playwright/test";

/**
 * Loads the application against the simulated client and returns nothing.
 *
 * The guards live here rather than in the `test` callback because
 * `playwright/no-conditional-in-test` reports any branch inside one, and the
 * journey specs use the same shape for the same reason.
 */
export async function contract_scaffold_renders(
  page: Page,
  origin: string,
): Promise<void> {
  const failures: string[] = [];
  const foreign: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  // Under simulation the generated SDK answers in the browser and reaches no
  // server, so every request a simulated bundle makes is same-origin with the
  // preview. A request to the API host means this build is live, which is what
  // a dropped `--mode contract` or a drifted mode string would produce, and a
  // suite that only checked rendering would stay green through it.
  page.on("request", (request) => {
    if (request.url().startsWith(origin) === false) foreign.push(request.url());
  });
  const response = await page.goto("/");
  if (response === null) throw new Error("Navigation returned no response.");
  if (response.ok() === false)
    throw new Error(`Navigation failed with status ${response.status()}.`);
  if (failures.length !== 0)
    throw new Error(`The page raised ${failures.join("; ")}.`);
  if (foreign.length !== 0)
    throw new Error(
      `A simulated build reached ${foreign.join("; ")}, so it is not simulated.`,
    );
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
  baseURL,
}) => {
  await contract_scaffold_renders(page, String(baseURL));
  await expect(page.locator("main")).toBeVisible();
});
