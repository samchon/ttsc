import { assertWatcherlessServeRevalidatesARepeatedModule } from "../../internal/adapter-vite-lifecycle";

/**
 * Verifies the build-scoped shortcut stops at a module's second delivery.
 *
 * The boundary of samchon/ttsc#1260: `beginTtscTransformBuild` settles only a
 * module's first delivery in the session from the supplied source, and the
 * `servedFiles` rule must keep holding when a watcherless serve session — not a
 * real build — is what selected that lifecycle.
 *
 * 1. Start a watcherless serve session and deliver one module.
 * 2. Change a project input the validation covers.
 * 3. Deliver the same module again and assert it recompiled.
 */
export const test_vite_serve_without_a_watcher_revalidates_a_repeated_module =
  async () => {
    await assertWatcherlessServeRevalidatesARepeatedModule();
  };
