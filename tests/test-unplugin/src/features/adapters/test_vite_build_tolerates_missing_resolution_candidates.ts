import assert from "node:assert/strict";

import {
  buildFixture,
  createLinkedWorkspaceFixture,
} from "../../internal/adapter-vite-serve";

/**
 * Verifies vite build: tolerates missing resolution candidates.
 *
 * The serve-only routing in `core/index.ts` must not leak into the build lane:
 * without a dev server the adapter keeps handing every derived watch input —
 * missing candidates included — to Rollup's `addWatchFile`, whose contract
 * accepts paths that do not exist. Issue #965's downstream evidence showed
 * production builds passing while serve failed; this pins that the build lane
 * stays green over the exact fixture the serve scenarios use.
 *
 * 1. Build the linked-workspace fixture with a production Vite build.
 * 2. Assert the bundle contains the resolved package binding.
 */
export const test_vite_build_tolerates_missing_resolution_candidates =
  async () => {
    const fixture = createLinkedWorkspaceFixture();
    const code = await buildFixture(fixture);
    assert.match(code, /linked/);
  };
