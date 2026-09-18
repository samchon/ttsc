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
 * Asserts the negative twin: a pure preload import with no explicit call
 * registers exactly one default loader that transforms with the project's own
 * tsconfig configuration.
 *
 * The one-line `bunfig.toml` preload convenience must keep working: importing
 * the side-effect entry under Bun registers a single default plugin, and that
 * plugin applies the fixture's tsconfig-declared transform.
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
