import assert from "node:assert/strict";

import { buildFixture } from "../../internal/adapter-vite-serve/buildFixture";
import { createLinkedWorkspaceFixture } from "../../internal/adapter-vite-serve/createLinkedWorkspaceFixture";

/**
 * Verifies a Vite production build succeeds while resolution candidates are
 * still missing.
 *
 * A linked workspace makes the compiler probe candidates that do not exist.
 * Those absent paths are recorded as watch inputs, and a build must treat them
 * as ordinary missing inputs, not as unresolvable modules that abort the
 * bundle.
 *
 * 1. Create the linked workspace fixture whose graph records missing candidates.
 * 2. Build it with Vite and the ttsc adapter.
 * 3. Assert the bundle contains the linked package's binding.
 */
export async function test_vite_build_tolerates_missing_resolution_candidates(): Promise<void> {
  const fixture = createLinkedWorkspaceFixture();
  const code = await buildFixture(fixture);
  assert.match(code, /linked/);
}
