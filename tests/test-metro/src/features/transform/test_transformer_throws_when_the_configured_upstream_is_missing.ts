import { assertMissingUpstreamThrows } from "../../internal/metro-transform";

/**
 * Verifies the transformer throws when the configured upstream is missing.
 *
 * A custom `upstreamTransformer` pointing at an unresolvable module is a
 * configuration error that must surface, not be swallowed. Upstream resolution
 * happens before file filtering, so even a pass-through file raises it.
 *
 * 1. Configure `upstreamTransformer` to a non-existent module.
 * 2. Run the transformer.
 * 3. Assert it rejects with a "could not load the configured upstream" message.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored transformer rejects a missing configured upstream before passing a JavaScript file through.
 * @evidence contracts/testing.md#independent-expectations The literal absent module and configured-upstream error contract distinguish resolver failure from silently dropping the file.
 * @evidence contracts/testing.md#distinguishing-cases Missing upstream on a compiler-excluded input proves loading precedes source gating.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_transformer_throws_when_the_configured_upstream_is_missing =
  async () => {
    await assertMissingUpstreamThrows();
  };
