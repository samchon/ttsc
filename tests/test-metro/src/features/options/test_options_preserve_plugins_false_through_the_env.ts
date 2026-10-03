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
 *
 * @evidence contracts/testing.md#behavioral-verification The actual serializer and resolver retain explicit plugins:false instead of reverting to automatic project plugin selection.
 * @evidence contracts/testing.md#independent-expectations The options contract distinguishes absent plugins from explicit false; the assertion demands the boolean false.
 * @evidence contracts/testing.md#distinguishing-cases Explicit false contrasts the populated plugin list and absent-property defaults owned by adjacent entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls serializeOptions and resolveOptionsFromEnv from packages/metro/src/core/options.ts in-process with TTSC_METRO_OPTIONS set and restored by the helper; no child process, native build or installed package.
 */
export const test_options_preserve_plugins_false_through_the_env = async () => {
  await assertOptionsPreservePluginsFalse();
};
