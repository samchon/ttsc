import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { readPluginBuildEnvironment } from "../../../../../packages/ttsc/src/plugin/internal/source/readPluginBuildEnvironment";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that Go's module and workspace toolchain selection invalidates a
 * build-environment answer, including a newly created ancestor workspace. A
 * path-only GOTOOLCHAIN confines the failing selection to the local host.
 *
 * 1. Record the usable toolchain in a child module and reread it unchanged.
 * 2. Add and remove an ancestor workspace that selects an unavailable version.
 * 3. Edit the module to select that version, then restore the working version.
 *
 * @evidence contracts/testing.md#behavioral-verification The direct answer reader over a real Go SDK and private store returns the working digest while selection holds, then produces a different digest and refuses the preceding witness whenever Go's selection files move.
 * @evidence contracts/testing.md#independent-expectations Go's toolchain selection rules give the ancestor workspace precedence and reject the authored higher requirement with path-only lookup. Restoring the original requirement restores the original build inputs.
 * @evidence contracts/testing.md#distinguishing-cases Covers absence, creation, removal and edit across module and workspace files, plus a stable recorded-answer control. The separate packaged identity unit owns shipped SDK metadata and version changes.
 * @evidence contracts/testing.md#execution-ownership The unit probes an installed Go tool directly using local-only selection. It owns the temporary module, workspace and answer store, and runs no plugin build or installed ttsc host.
 */
export function test_plugin_build_environment_follows_toolchain_selection_files(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-go-selection-"),
  );
  const module = path.join(root, "module");
  fs.mkdirSync(module);
  const env = SidecarEnvironment.merge(process.env, {
    GOENV: "off",
    GOTOOLCHAIN: "path",
    GOROOT: undefined,
    GOFLAGS: undefined,
    CGO_ENABLED: "0",
  });
  const sdk = spawnSync("go", ["env", "GOROOT"], {
    cwd: root,
    env: SidecarEnvironment.merge(env, { GOWORK: "off", GOTOOLCHAIN: "local" }),
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(sdk.status, 0, sdk.stderr);
  const binary = path.join(
    sdk.stdout.trim(),
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  const store = () =>
    PluginContentIdentities.open({
      projectRoot: root,
      cacheDir: path.join(root, "cache"),
      env,
    });
  const read = () => {
    const witness: PluginBuildEnvironmentWitness.Record = new Map();
    const digest = readPluginBuildEnvironment(
      binary,
      module,
      env,
      witness,
      store(),
    );
    return { witness, digest };
  };
  const manifest = path.join(module, "go.mod");
  const workspace = path.join(root, "go.work");
  const goodModule = "module example.com/module\n\ngo 1.23.0\n";
  fs.writeFileSync(manifest, goodModule);
  const previous = read();
  assert.equal(read().digest, previous.digest);
  assert.equal(PluginBuildEnvironmentWitness.holds(previous.witness), true);
  fs.writeFileSync(workspace, "go 1.99.0\n\nuse ./module\n");
  assert.equal(PluginBuildEnvironmentWitness.holds(previous.witness), false);
  const withWorkspace = read();
  assert.notEqual(withWorkspace.digest, previous.digest);
  fs.unlinkSync(workspace);
  assert.equal(
    PluginBuildEnvironmentWitness.holds(withWorkspace.witness),
    false,
  );
  assert.equal(read().digest, previous.digest);
  fs.writeFileSync(manifest, "module example.com/module\n\ngo 1.99.0\n");
  assert.equal(PluginBuildEnvironmentWitness.holds(previous.witness), false);
  assert.notEqual(read().digest, previous.digest);
  fs.writeFileSync(manifest, goodModule);
  assert.equal(read().digest, previous.digest);
}
