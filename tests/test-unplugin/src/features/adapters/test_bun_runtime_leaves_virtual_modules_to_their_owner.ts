import { assertBunRuntimeLeavesVirtualModulesToTheirOwner } from "../../internal/adapter-bun";

/**
 * Verifies Bun runtime does not claim another plugin's virtual module.
 *
 * A NUL id is not a filesystem path. If the broad TypeScript hook accepts it,
 * the runtime pass-through branch tries to read it from disk and prevents the
 * module's owning loader from running.
 *
 * 1. Capture the runtime-shaped Bun loader registration.
 * 2. Test its filter against NUL-prefixed and ordinary TypeScript paths.
 * 3. Assert only real filesystem-shaped source ids are claimed.
 */
export const test_bun_runtime_leaves_virtual_modules_to_their_owner =
  async () => {
    await assertBunRuntimeLeavesVirtualModulesToTheirOwner();
  };
