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
 * @evidence contracts/testing.md#behavioral-verification An actual transform records its Go source; an unchanged environment keeps the key and temporary GOFLAGS change invalidates it.
 * @evidence contracts/testing.md#independent-expectations Native plugin binaries depend on their build environment as well as source bytes; exact equality and inequality independently express that contract.
 * @evidence contracts/testing.md#distinguishing-cases Stable environment is the positive reuse control beside one GOFLAGS mutation with unchanged files.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler delivery must identify the plugin tree whose build environment contributes to the adapter key.
 * @evidence contracts/e2e.md#shared-execution One initial native project transform uses the suite shared producer cache. GOFLAGS is only fingerprinted for the second comparison, without rebuilding a plugin just to observe its key. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity  Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage Original recorded-source membership, stable key and changed-environment key assertions remain.
 */
export async function case_metro_cache_key_changes_when_the_plugin_build_environment_changes(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
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
  const previous = process.env.GOFLAGS;
  process.env.GOFLAGS = "-tags=ttsc_metro_environment_probe";
  try {
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
