import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import type { CapturedPlugin } from "../../internal/adapter-bun-register/CapturedPlugin";
import { captureLoader } from "../../internal/adapter-bun-register/captureLoader";
import { importFreshBunRegister } from "../../internal/adapter-bun-register/importFreshBunRegister";
import { requireFreshBunRegister } from "../../internal/adapter-bun-register/requireFreshBunRegister";
import { withBunRuntime } from "../../internal/adapter-bun-register/withBunRuntime";

/**
 * Drive a captured Bun plugin's single `onLoad` handler for one file and return
 * the transformed contents, mirroring how Bun invokes the loader.
 */
async function driveCapturedLoader(
  plugin: CapturedPlugin,
  file: string,
): Promise<string> {
  const loader = await captureLoader(plugin);
  return (await loader({ path: file })).contents;
}

/**
 * Verifies a pure preload import registers exactly one default loader, which
 * transforms with the project's tsconfig.
 *
 * The one-line `bunfig.toml` preload convenience must keep working without an
 * explicit call. Evaluating both package conditions, CommonJS then ESM, must
 * share one loader: Bun uses the first matching `onLoad` hook and does not fall
 * through (oven-sh/bun#20583), so a second registration would shadow the first
 * rather than run beside it, and which options applied would depend on
 * evaluation order.
 *
 * 1. Require the CommonJS entry under a Bun stub, then import the ESM entry.
 * 2. Assert only one plugin was registered.
 * 3. Load the entry module through it and assert the tsconfig-declared transform
 *    applied.
 *
 * @evidence contracts/testing.md#behavioral-verification CJS then ESM preload yields one captured loader, PLUGIN output and harmless repeated default registrations.
 * @evidence contracts/testing.md#independent-expectations One loader prevents first-match shadowing; fixture PLUGIN output proves tsconfig transform applies.
 * @evidence contracts/testing.md#distinguishing-cases Opposite module evaluation order to explicit-options case, default configuration and locked idempotent calls.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_bun_register_preload_only_registers_a_single_default_plugin is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built CJS/ESM entries share runtime registration and real native transform under a Bun global stub.
 * @evidence contracts/e2e.md#shared-execution Built ESM/CJS entries reuse captured runtime within each order; separate scopes isolate registration histories.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh module-entry helpers and local captured arrays separate runtime histories; temporary Bun globals are restored in finally. Transform fixtures use private tracked roots. Captured loader sessions have no per-case disposal assertion; process exit bounds their lifetime.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: cJS then ESM preload yields one captured loader, PLUGIN output and harmless repeated default registrations. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_bun_register_preload_only_registers_a_single_default_plugin(): Promise<void> {
  const captured: CapturedPlugin[] = [];
  await withBunRuntime(captured, async () => {
    const registerCjs = requireFreshBunRegister();

    assert.equal(captured.length, 1);
    const registerEsm = await importFreshBunRegister();
    assert.equal(
      captured.length,
      1,
      "importing the ESM condition after a CommonJS preload must share its loader",
    );

    const root = TestUnpluginProject.createProject();
    const output = await driveCapturedLoader(
      captured[0]!,
      TestUnpluginProject.mainFile(root),
    );
    TestUnpluginProject.assertTransformedToPlugin(output);
    assert.doesNotThrow(() => {
      registerCjs();
      registerEsm();
    }, "both conditions must see the same locked default configuration");
  });
}
