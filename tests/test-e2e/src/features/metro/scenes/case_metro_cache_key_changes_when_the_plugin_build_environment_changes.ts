import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { prepareSnapshot, cacheKeyForRun, readMainSnapshot } from "../../../internal/metro/internal/metro-snapshot";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies a Metro run's key carries the environment each recorded plugin
 * source's binary is built in, so a restart under another `GOFLAGS` or Go
 * toolchain re-keys the run (samchon/ttsc#1493).
 *
 * A plugin's binary is keyed on its Go source and on its build environment, and
 * since samchon/ttsc#1487 the run's key carried the source alone: a restart
 * under another `GOFLAGS` reused every module the other binary produced. The
 * state a recorded plugin source carries is now the one the build keys on,
 * sources and environment together. Exercises the real native compiler, so it
 * runs where the Go toolchain is present.
 *
 * 1. Run a transform whose plugin's Go source is the project's own copy, and
 *    prepare the next run with that source recorded as a tree.
 * 2. Assert the key holds under an unchanged environment.
 * 3. Set another `GOFLAGS`, and assert the key differs.
 *
 * @evidence contracts/testing.md#behavioral-verification An actual transform records its Go source under an explicit baseline GOFLAGS; an unchanged environment keeps the key and the original distinct probe GOFLAGS changes it. The original ambient absent/value state is restored even if setup or an earlier observation fails.
 * @evidence contracts/testing.md#independent-expectations Native plugin binaries depend on their build environment as well as source bytes; exact equality and inequality independently express that contract.
 * @evidence contracts/testing.md#distinguishing-cases Stable environment is the positive reuse control beside one GOFLAGS mutation with unchanged files.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro invokes the scenario; TestMetroRuntime defaults to built transformer modules unless TTSC_TEST_LAYER=unit. The authored echo upstream does not make a real Metro server or OS worker, and source-layer override execution does not establish the built boundary.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler delivery must identify the plugin tree whose build environment contributes to the adapter key.
 * @evidence contracts/e2e.md#shared-execution One initial awaited transform uses the selected shared producer; subsequent GOFLAGS key comparisons do not request another transform/rebuild or certify child/Program/cache counts. Its mutable Go copy is an owned workspace slot; query imports are suite-process modules rather than additional OS workers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Before initial preparation, an explicit baseline differs from the original probe marker even if ambient GOFLAGS already equals it. Outer finally restores the exact previous absent/value state on all exits. Slot replacement resets snapshots; awaited transformer options env and parent workspace cleanup have separate owners, not arbitrary-descendant/loaded-image certificates.
 * @evidence contracts/e2e.md#preserved-coverage Original source-tree membership, unchanged-key equality and original -tags=ttsc_metro_environment_probe inequality remain, with a distinct baseline premise. There is no post-change output/rebuild/toolchain-switch/restart observation; built-layer selection, registration, runtime survival and measurement remain unverified.
 */
export async function case_metro_cache_key_changes_when_the_plugin_build_environment_changes(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const previous = process.env.GOFLAGS;
  process.env.GOFLAGS = "-tags=ttsc_metro_environment_baseline";
  try {
  const root = MetroWorkspace.enterProject(workspace);
  const source = path.join(root, "go-plugin");
  fs.cpSync(TestUnpluginProject.pluginSource(root), source, {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    'module.exports = (context) => ({ name: context.plugin.name, source: "./go-plugin" });\n',
  );
  const options = {
    upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
  };

  await prepareSnapshot(root);
  await TestMetroRuntime.runTransform({
    options,
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  await prepareSnapshot(root);
  assert.ok(
    readMainSnapshot(root).trees.includes(source),
    "recorded as a tree",
  );
  const before = await cacheKeyForRun(root, options);
  assert.equal(
    await cacheKeyForRun(root, options),
    before,
    "an unchanged environment keeps the key",
  );
  process.env.GOFLAGS = "-tags=ttsc_metro_environment_probe";
    assert.notEqual(
      await cacheKeyForRun(root, options),
      before,
      "another GOFLAGS re-keys the run",
    );
  } finally {
    if (previous === undefined) delete process.env.GOFLAGS;
    else process.env.GOFLAGS = previous;
  }
}
