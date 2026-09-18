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
