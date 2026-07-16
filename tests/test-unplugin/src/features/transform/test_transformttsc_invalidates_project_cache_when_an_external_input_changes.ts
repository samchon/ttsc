import { assertCacheInvalidatesOnExternalInputChange } from "../../internal/transform-external";

/**
 * Verifies the project cache invalidates when a reported out-of-walk input
 * changes.
 *
 * The walk snapshot cannot see files outside the project root, so before
 * samchon/ttsc#721 a host that never clears its cache between builds (Metro
 * workers, the Turbopack loader, Bun) replayed the stale generation for its
 * whole process lifetime after such an edit. `externalInputHashes` re-hashes
 * the reported set on every validation.
 *
 * 1. Transform a file whose plugin reads and reports a helper outside the project
 *    root ("first") through one shared cache.
 * 2. Edit only the external helper to "second" — no in-project change.
 * 3. Transform again with the same cache; assert the output carries
 *    `PLUGIN:SECOND`.
 */
export const test_transformttsc_invalidates_project_cache_when_an_external_input_changes =
  async () => {
    await assertCacheInvalidatesOnExternalInputChange();
  };
