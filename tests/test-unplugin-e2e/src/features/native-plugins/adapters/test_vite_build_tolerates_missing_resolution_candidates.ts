import assert from "node:assert/strict";

import { buildFixture } from "../../../internal/adapter-vite-serve/buildFixture";
import { createLinkedWorkspaceFixture } from "../../../internal/adapter-vite-serve/createLinkedWorkspaceFixture";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Vite bundles linked workspace with linked binding despite absent compiler resolution candidates.
 * @evidence contracts/testing.md#independent-expectations Linked fixture binding is authored independently; successful build proves absent watch inputs do not become unresolved runtime imports.
 * @evidence contracts/testing.md#distinguishing-cases Positive linked package resolution with missing preferred candidates; serve recovery has separate cases.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_build_tolerates_missing_resolution_candidates is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Actual Vite production resolver consumes linked workspace and built native adapter.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: vite bundles linked workspace with linked binding despite absent compiler resolution candidates. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_build_tolerates_missing_resolution_candidates(): Promise<void> {
  const fixture = createLinkedWorkspaceFixture();
  const code = await buildFixture(fixture);
  assert.match(code, /linked/);
}
