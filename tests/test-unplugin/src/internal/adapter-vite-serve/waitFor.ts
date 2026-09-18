import assert from "node:assert/strict";

/** Poll a condition until it holds or the deadline passes. */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  what: string,
  timeout = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`timed out waiting for ${what}`);
}
