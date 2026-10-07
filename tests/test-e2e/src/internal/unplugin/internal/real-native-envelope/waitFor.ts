import assert from "node:assert/strict";

/** Poll an asynchronous adapter consequence until it is observed. */
export async function waitFor(
  predicate: () => boolean,
  what: string,
  timeout = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`timed out waiting for ${what}`);
}
