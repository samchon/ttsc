import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { projectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/projectRecordFile";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { refreshProjectRecordFiles } from "../../../../../packages/unplugin/src/core/bridge/refreshProjectRecordFiles";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/writeProjectRecordFile";
import { pluginSourceState } from "../../../../../packages/unplugin/src/core/transform/inputs/pluginSourceState";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies project-record refresh follows actual plugin source and native
 * build-environment inputs while ignoring unchanged and pruned source writes.
 *
 * A tree state includes the environment used to key a plugin build. This case
 * keeps the actual Go environment reader rather than replacing that input
 * with a synthetic digest; it builds no plugin or compiler artifact.
 *
 * 1. Deliver a real source-tree record and require unchanged refresh to stay
 *    quiet, including writes under .git and node_modules.
 * 2. Add a Go file and edit main.go; require each to move the signal, with a
 *    re-delivered current baseline returning to quiet between them.
 * 3. Change a deliberately distinct GOFLAGS baseline to the original donor
 *    marker and require invalidation, restoring the original environment.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual pluginSourceState and projectRecordFile/write/read/refreshProjectRecordFiles over the original four copied fixture inputs. Literal signals zero/one distinguish unchanged and pruned writes, addition, recovery, edit and a changed build environment.
 * @evidence contracts/testing.md#independent-expectations Authored source inclusion/pruning and actual changed GOFLAGS define quiet versus invalidation independently of the reported digest. Expected signals are literal; pluginSourceState supplies only the delivered baseline. A fixed distinct baseline makes the final environment change real even if ambient GOFLAGS already equals the donor marker.
 * @evidence contracts/testing.md#distinguishing-cases Initial delivery and unchanged refresh, each ignored directory, a new Go file, re-delivery recovery, an existing-file edit and actual environment change retain the source-record matrix. Null state is rejected rather than accepted as a baseline; outer finally restores absent/value GOFLAGS after any failure.
 * @evidence contracts/testing.md#execution-ownership This discoverable direct unit copies the existing package-owned four-file fixture without changing bytes and exercises record proof/effects. Native go env/go version and GOROOT identity are inputs read by the owning state provider, not a compiler/plugin build or consumer host. No native artifact or host is started; no E2E transport connection is replaced or certified.
 */
export async function test_project_record_tracks_plugin_source_and_environment(): Promise<void> {
  const root = fs.realpathSync.native(TestProject.tmpdir("ttsc-unplugin-source-record-unit-"));
  TestProject.copyDirectory(
    path.join(TestProject.WORKSPACE_ROOT, "packages/unplugin/test/fixtures/e2e/project_record_moves_when_a_plugin_source_does/inputs-1"),
    root,
  );
  const tsconfig = path.join(root, "tsconfig.json");
  const source = path.join(root, "plugin");
  const sourceBytes = fs.readFileSync(path.join(source, "main.go"));
  const tool = path.join(root, ".ttsc");
  const file = projectRecordFile(tool, tsconfig);
  const previous = process.env.GOFLAGS;
  process.env.GOFLAGS = "-tags=ttsc_record_environment_baseline";
  try {
    const deliver = (): void => {
      const digest = pluginSourceState(source);
      assert.ok(digest, "actual source and native build environment must be readable");
      writeProjectRecordFile(file, {
        inputs: { [source]: { identity: source, missing: false, state: { codec: "tree", digest } } },
        membership: null, root, signal: 0, tsconfig,
      });
    };
    const refresh = (): void => refreshProjectRecordFiles(tool);
    const signal = (): number | undefined => readProjectRecordFile(file)?.signal;
    deliver();
    assert.equal(signal(), 0, "first delivered record");
    refresh();
    assert.equal(signal(), 0, "unchanged source and native environment");
    for (const pruned of ["node_modules", ".git"]) {
      fs.mkdirSync(path.join(source, pruned), { recursive: true });
      fs.writeFileSync(path.join(source, pruned, "ignored.go"), sourceBytes);
      refresh();
      assert.equal(signal(), 0, `${pruned}: ignored source write`);
    }
    fs.writeFileSync(path.join(source, "extra.go"), sourceBytes);
    refresh();
    assert.equal(signal(), 1, "new Go source invalidates the delivered baseline");
    deliver();
    refresh();
    assert.equal(signal(), 0, "current delivered state recovers quiet");
    fs.appendFileSync(path.join(source, "main.go"), "// edited\n");
    refresh();
    assert.equal(signal(), 1, "existing Go source edit invalidates");
    deliver();
    assert.equal(signal(), 0);
    process.env.GOFLAGS = "-tags=ttsc_record_environment_probe";
    refresh();
    assert.equal(signal(), 1, "distinct native Go build environment invalidates");
  } finally {
    if (previous === undefined) delete process.env.GOFLAGS;
    else process.env.GOFLAGS = previous;
  }
}
