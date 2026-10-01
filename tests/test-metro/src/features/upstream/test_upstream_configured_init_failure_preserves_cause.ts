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
 * @evidence contracts/testing.md#behavioral-verification Resolving a module that throws its authored ABI mismatch retains the original message, Error cause and stack without claiming absence.
 * @evidence contracts/testing.md#independent-expectations The fixture module throws a literal upstream dependency ABI mismatch, so its message/cause are independent of the resolver implementation.
 * @evidence contracts/testing.md#distinguishing-cases Resolvable but broken initialization contrasts absent candidates and missing transitive dependency cases.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_upstream_configured_init_failure_preserves_cause =
  async () => {
    await assertConfiguredInitFailurePreservesCause();
  };
