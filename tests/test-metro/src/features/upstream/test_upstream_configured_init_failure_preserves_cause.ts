import { assertConfiguredInitFailurePreservesCause } from "../../internal/metro-upstream";

/**
 * Verifies an explicit upstream that throws during initialization surfaces the
 * original diagnostic.
 *
 * Pins the initialization-error branch: a configured module that resolves but
 * throws at top level (an ABI/runtime rejection) must not be flattened into the
 * generic "could not load" absence message. The original message and stack are
 * preserved through the Error `cause`, run through the production `require`
 * loader against a real broken module on disk.
 *
 * 1. Point `upstreamTransformer` at a module that throws while loading.
 * 2. Resolve it through the real loader.
 * 3. Assert the original message is preserved and attached as `cause`, not the
 *    absence message.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveUpstreamTransformer with the path of a temp CommonJS file that throws "upstream dependency ABI mismatch" at top level, through the default require loader, throws an error whose message chain contains that text, which does not match the could-not-load absence message, and whose cause is an Error with that message and a string stack.
 * @evidence contracts/testing.md#independent-expectations The fixture file throws an authored literal message, so the expected text and the cause attachment come from the test's own module rather than from the resolver.
 * @evidence contracts/testing.md#distinguishing-cases Only a module that resolves and then throws on initialization is run; plain absence, an unexported subpath and a missing transitive dependency are covered by neighboring entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveUpstreamTransformer from packages/metro/src/core/upstream.ts in-process with the real require loader against one temp .cjs file; no compile, install or Metro host is involved.
 */
export const test_upstream_configured_init_failure_preserves_cause =
  async () => {
    await assertConfiguredInitFailurePreservesCause();
  };
