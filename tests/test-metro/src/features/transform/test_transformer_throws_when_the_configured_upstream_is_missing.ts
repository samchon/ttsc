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
 */
export const test_transformer_throws_when_the_configured_upstream_is_missing =
  async () => {
    await assertMissingUpstreamThrows();
  };
