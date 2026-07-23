import { assertBunRuntimeDoesNotRehashProjectPerModule } from "../../internal/adapter-bun";

/**
 * Verifies a Bun runtime plugin setup is one cache lifecycle.
 *
 * The runtime builder has no `onStart`. Leaving that cache persistent makes
 * each first module delivery hash every project input again, recreating the
 * quadratic startup amplification reported in #969. The adapter must mark its
 * process-scoped loading session during setup.
 *
 * 1. Compile an entry whose generation also emits an unrequested lazy module.
 * 2. Change another project input inside the same runtime session.
 * 3. Assert the first lazy delivery still uses the session generation.
 */
export const test_bun_runtime_does_not_rehash_the_project_per_module =
  async () => {
    await assertBunRuntimeDoesNotRehashProjectPerModule();
  };
