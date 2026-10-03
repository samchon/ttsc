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
 * @evidence contracts/testing.md#behavioral-verification transform of a .js file with upstreamTransformer "@@ttsc-metro-nonexistent-upstream@@" rejects with a message matching /Could not load the configured upstream transformer/.
 * @evidence contracts/testing.md#independent-expectations The authored nonexistent module name and the documented configured-upstream error message distinguish a surfaced configuration error from silently passing the file through.
 * @evidence contracts/testing.md#distinguishing-cases A JavaScript file, which the filter would pass through anyway, still raises the error, showing upstream loading happens before source gating; no case with a resolvable upstream is run here.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls the transformer module's transform in-process with a worker environment naming a nonexistent upstream; no native compile, consumer install or Metro host.
 */
export const test_transformer_throws_when_the_configured_upstream_is_missing =
  async () => {
    await assertMissingUpstreamThrows();
  };
