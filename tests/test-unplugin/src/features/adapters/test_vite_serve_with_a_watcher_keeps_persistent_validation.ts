import { assertWatchingServeKeepsPersistentValidation } from "../../internal/adapter-vite-lifecycle";

/**
 * Verifies a watching dev server keeps persistent per-delivery validation.
 *
 * The negative twin of the watcherless case: the lifecycle decision reads
 * `server.watch` beside `config.command`, and a server that can observe an edit
 * must keep proving each delivery, because its single `buildStart` spans every
 * later edit and hot update (samchon/ttsc#1260).
 *
 * 1. Resolve the adapter's config as `command: "serve"` with a live watcher and
 *    run `buildStart`.
 * 2. Deliver one module, then change a project input the validation covers.
 * 3. Deliver every remaining module and assert the changed input forced exactly
 *    one replacement generation.
 */
export const test_vite_serve_with_a_watcher_keeps_persistent_validation =
  async () => {
    await assertWatchingServeKeepsPersistentValidation();
  };
