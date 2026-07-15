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
 */
export const test_upstream_configured_init_failure_preserves_cause =
  async () => {
    await assertConfiguredInitFailurePreservesCause();
  };
