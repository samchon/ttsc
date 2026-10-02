import assert from "node:assert/strict";

import type { INextLikeConfig } from "../internal/adapter-next/INextLikeConfig";
import { loadNext } from "../internal/adapter-next/loadNext";

/**
 * Verifies the wrapper warns when a caller's `webpack` hook stops running under
 * Turbopack.
 *
 * Next refuses to build on Turbopack when a config carries a `webpack` hook and
 * no `turbopack` block, because the hook is then silently ignored. This wrapper
 * always defines both, so that check can never fire again for anyone who uses
 * it. Wiring Turbopack is worth one warning, not the loss of the warning Next
 * already gave (samchon/ttsc#1310).
 *
 * 1. Capture stderr while wrapping a config that carries only a `webpack` hook.
 * 2. Assert the warning names the Turbopack wiring and says Next would have
 *    stopped the build.
 * 3. Assert nothing is written for a config without a hook, or one that already
 *    configures Turbopack.
 * @evidence contracts/testing.md#behavioral-verification
 *   Captures stderr while calling authored next, asserting the ignored caller hook names Turbopack and the lost build refusal; restores stderr even on an assertion failure.
 * @evidence contracts/testing.md#independent-expectations
 *   The caller-facing warning contract is independent: a supplied webpack hook without Turbopack configuration loses Next's build refusal. Literal message concepts detect a silently dropped customization.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The warning case has a hook and no Turbopack block; three controls cover no hook, explicit Turbopack with a hook and explicit Turbopack without a hook. Empty stderr distinguishes undesired warnings.
 * @evidence contracts/testing.md#execution-ownership
 *   test_next_adapter_warns_about_a_suppressed_webpack_hook calls next from loadNext under its capture helper for all four configs and restores stderr in finally; it tests the wrapper warning without starting Next.
 */
export async function test_next_adapter_warns_about_a_suppressed_webpack_hook(): Promise<void> {
  const next = await loadNext();
  const capture = (config: INextLikeConfig): string => {
    const original = process.stderr.write;
    let written = "";
    process.stderr.write = ((chunk: unknown) => {
      written += String(chunk);
      return true;
    }) as typeof process.stderr.write;
    try {
      next(config);
    } finally {
      process.stderr.write = original;
    }
    return written;
  };

  const warned = capture({ webpack: (config) => config });
  assert.match(
    warned,
    /withTtsc now configures Turbopack/,
    "a caller's own webpack hook must not be dropped in silence",
  );
  // What this wrapper suppresses is a refusal, not a warning. Next 16.3.2's
  // `turbopack-warning.js` logs an error and calls `process.exit(1)` when the
  // bundler was defaulted, a `webpack` hook exists, and no `turbopack` block
  // does — and `hasTurboConfig` is read from this wrapper's own return value.
  // Saying "warn" understates what the caller loses (samchon/ttsc#1320).
  assert.match(
    warned,
    /stop the build/,
    "the message must say the build would have been stopped, not merely warned about",
  );

  assert.equal(
    capture({}),
    "",
    "a caller with no webpack hook has nothing to lose",
  );
  assert.equal(
    capture({ turbopack: { rules: {} }, webpack: (config) => config }),
    "",
    "a caller who already configured Turbopack has made the decision",
  );
  assert.equal(
    capture({ turbopack: { rules: {} } }),
    "",
    "a caller who configured only Turbopack has no webpack hook to lose",
  );
}
