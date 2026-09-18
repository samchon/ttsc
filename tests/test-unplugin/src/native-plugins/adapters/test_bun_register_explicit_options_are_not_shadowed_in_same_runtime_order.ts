import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import type { CapturedPlugin } from "../../internal/adapter-bun-register/CapturedPlugin";
import { captureLoader } from "../../internal/adapter-bun-register/captureLoader";
import { importFreshBunRegister } from "../../internal/adapter-bun-register/importFreshBunRegister";
import { requireFreshBunRegister } from "../../internal/adapter-bun-register/requireFreshBunRegister";
import { withBunRuntime } from "../../internal/adapter-bun-register/withBunRuntime";

/**
 * Verifies that accessing the explicit `register(options)` API in the real
 * same-runtime order cannot install a shadowing default loader, and that the
 * explicit options are the ones that transform and then remain immutable.
 *
 * Bun uses the first matching `onLoad` hook and does not fall through to a
 * later overlapping plugin (oven-sh/bun#20583). The module auto-registers on
 * import, so a caller importing it to reach `register(options)` would, under
 * the old code, get a default plugin registered first that shadows the explicit
 * one. The entry must register exactly one Bun loader whose effective options
 * are resolved on first load, so calls before that boundary are last-write-wins
 * and calls after it cannot silently change the session. Evaluating the second
 * package condition must not erase options already supplied through the first.
 */
export async function test_bun_register_explicit_options_are_not_shadowed_in_same_runtime_order(): Promise<void> {
  const preservationCaptured: CapturedPlugin[] = [];
  await withBunRuntime(preservationCaptured, async () => {
    const registerEsm = await importFreshBunRegister();
    const preserved = {
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "prefix",
          prefix: "PRESERVED:",
        },
      ],
    };
    registerEsm(preserved);

    const registerCjs = requireFreshBunRegister();
    assert.equal(
      preservationCaptured.length,
      1,
      "evaluating the CommonJS condition must keep the existing loader",
    );
    const loader = await captureLoader(preservationCaptured[0]!);
    const missing = path.join(
      TestProject.tmpdir("ttsc-bun-register-pending-"),
      "missing.ts",
    );
    const pending = loader({ path: missing });

    assert.doesNotThrow(
      () => registerCjs(preserved),
      "the CommonJS condition must preserve options supplied through ESM",
    );
    await assert.rejects(pending, /ENOENT/);
  });

  const captured: CapturedPlugin[] = [];
  await withBunRuntime(captured, async () => {
    const registerEsm = await importFreshBunRegister();

    // Import-time auto-registration produced exactly one loader.
    assert.equal(captured.length, 1);
    const registerCjs = requireFreshBunRegister();
    assert.equal(
      captured.length,
      1,
      "requiring the CommonJS condition after the ESM preload must share its loader",
    );
    const loader = await captureLoader(captured[0]!);

    // Calls through both conditions after setup but before the first load
    // replace one detached snapshot without adding a shadowing loader.
    registerEsm({
      plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: "A:" }],
    });
    const supplied = {
      plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: "B:" }],
    };
    registerCjs(supplied);
    supplied.plugins[0]!.prefix = "MUTATED:";
    assert.equal(captured.length, 1);

    const root = TestUnpluginProject.createProject({ plugins: [] });
    const pending = loader({ path: TestUnpluginProject.mainFile(root) });

    // Handler entry locks synchronously before its first await. An equal call
    // is idempotent, while a different one cannot win an I/O race.
    registerEsm({
      plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: "B:" }],
    });
    assert.throws(
      () =>
        registerCjs({
          plugins: [
            { transform: "./plugin.cjs", name: "prefix", prefix: "C:" },
          ],
        }),
      /options are locked[\s\S]*Restart the Bun process/,
    );
    assert.equal(captured.length, 1);
    const output = await pending;
    assert.match(output.contents, /"B:plugin"/);
    assert.doesNotMatch(output.contents, /MUTATED:|"C:plugin"/);
  });
}
