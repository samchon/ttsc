import { assertBunAdapterExcludesNulVirtualIds } from "../../internal/adapter-bun";

/**
 * Verifies the Bun adapter filter excludes NUL-prefixed virtual ids.
 *
 * A NUL id is not a filesystem path. If the broad TypeScript hook accepts it,
 * the adapter attempts a disk read before Bun can apply the appropriate
 * virtual-module mechanism.
 *
 * 1. Capture the runtime-shaped Bun loader registration.
 * 2. Test its filter against NUL-prefixed and ordinary TypeScript paths.
 * 3. Assert the filter accepts only the filesystem-shaped paths.
 */
export const test_bun_adapter_excludes_nul_virtual_ids = async () => {
  await assertBunAdapterExcludesNulVirtualIds();
};
