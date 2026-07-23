import { assertBunRuntimePassesThroughUnchangedSource } from "../../internal/adapter-bun";

/**
 * Verifies Bun runtime receives an object for unchanged TypeScript.
 *
 * Unlike `Bun.build`, Bun's runtime loader rejects `undefined`; a no-op ttsc
 * transform must return the original source instead of crashing module load.
 *
 * 1. Register the adapter against a runtime-shaped builder without `onStart`.
 * 2. Disable transforms and invoke its captured `onLoad` for a source file.
 * 3. Assert the original contents and loader are returned instead of undefined.
 */
export const test_bun_runtime_passes_through_unchanged_source = async () => {
  await assertBunRuntimePassesThroughUnchangedSource();
};
