import { assertOptionsPreservePluginsFalse } from "../../internal/metro-options";

/**
 * Verifies options preserve `plugins: false` through the env.
 *
 * The negative twin of the round-trip test. `plugins: false` means "disable all
 * project plugins"; a falsy presence check would collapse it back to
 * `undefined` ("auto-read project plugins"), silently re-enabling plugins
 * inside the worker.
 *
 * 1. Serialize `{ plugins: false }` into the env var.
 * 2. Resolve options back.
 * 3. Assert `ttsc.plugins` is strictly `false`, not `undefined`.
 */
export const test_options_preserve_plugins_false_through_the_env = async () => {
  await assertOptionsPreservePluginsFalse();
};
