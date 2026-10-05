import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
import { TestProject } from "../../../../../../utils/src/TestProject";
import { FixtureFiles } from "../../../../internal/FixtureFiles";

const { spawnSync } = E2eProcessTrace;

/**
 * Verifies ttsx mirrors symlinked directory entries without Windows symlink
 * privileges.
 *
 * `prepareExecution` mirrors project-root entries into a virtual filesystem
 * layout after build. On Windows, a directory entry that is itself a symlink
 * needs to be mirrored as a junction; otherwise `fs.symlinkSync` defaults to a
 * privileged directory symlink and fails with EPERM.
 *
 * 1. Create a CJS ttsx project whose `node_modules` entry is a junction.
 * 2. Run ttsx against the entry.
 * 3. Assert the virtual-layout mirror completes and the entry executes.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx mirrors linked node_modules and executes junction-ok with zero status, detecting privileged re-symlink failure in virtual layout.
 * @evidence contracts/testing.md#independent-expectations Authored literal junction-ok and lstat proof of a real link establish independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases The existing installation caller selects Windows and supplies a real junction; direct local POSIX calls use a directory symlink but do not certify installed POSIX coverage. File symlink/copy behavior is a distinct direct unit, not equivalent topology.
 * @evidence contracts/testing.md#execution-ownership This named OS-boundary entry owns one real native directory link/launcher request. The installed matrix runner passes its installed candidate launcher and consumer parent, executes it directly under Node without workspace binary overrides, and resolves TypeScript through that consumer. Direct local calls retain the workspace launcher and its existing native selection.
 * @evidence contracts/e2e.md#necessary-boundary Real link topology must survive prepareExecution and Node assembly; direct linkVirtualEntry calls do not certify that connection.
 * @evidence contracts/e2e.md#shared-execution This request reuses the supplied installation while keeping a private consumer/link target/cache. No per-assertion install is prepared; runtime compilation and child population are delegated actual work, not independently measured as one host or avoided build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Owned consumer/link target/cache roots are retained before preparation/launch; workspace and installed invocation branches preserve their original environments. Actual synchronous error/signal/status does not establish descendant closure or loaded-image identity; no cleanup is authorized by text success alone.
 * @evidence contracts/e2e.md#preserved-coverage Original two-file fixture/native link check/status0/junction-ok and existing platform-specific link type remain. Registration/runtime/survival and trace population of the proposed consolidated installation are unverified; this statement does not certify other file-link units.
 */
export function case_ttsx_virtual_layout_junctions_symlinked_directory_entries_on_windows(
  ttsxBinary: string = TestProject.TTSX_BIN,
  consumerRoot?: string,
) {
  const root = TestProject.tmpdir("ttsx-junction-project-", consumerRoot);
  TestProject.retainTemporaryDirectory(
    root,
    "runtime layout native descendant closure is unacknowledged",
  );
  const files = FixtureFiles.read(
    "ttsc/ttsx_virtual_layout_junctions_symlinked_directory_entries_on_windows/inputs-1",
  );
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
  }
  const linkedModules = TestProject.tmpdir("ttsx-linked-node-modules-");
  TestProject.retainTemporaryDirectory(
    linkedModules,
    "runtime layout linked target may remain in use by descendants",
  );
  const nodeModules = path.join(root, "node_modules");
  fs.symlinkSync(
    linkedModules,
    nodeModules,
    process.platform === "win32" ? "junction" : undefined,
  );
  assert.equal(fs.lstatSync(nodeModules).isSymbolicLink(), true);

  const cache = TestProject.tmpdir("ttsx-junction-cache-");
  TestProject.retainTemporaryDirectory(
    cache,
    "runtime layout cache descendant closure is unacknowledged",
  );
  const env: NodeJS.ProcessEnv = { ...process.env, TTSC_CACHE_DIR: cache };
  for (const key of Object.keys(env)) {
    if (
      [
        "TTSC_BINARY",
        "TTSC_TSGO_BINARY",
        "TTSC_NODE_BINARY",
        "NODE_OPTIONS",
        "TTSX_RUNTIME_MANIFEST",
      ].includes(key.toUpperCase())
    )
      delete env[key];
  }
  const result =
    consumerRoot === undefined
      ? TestProject.spawn(ttsxBinary, ["--cwd", root, "src/main.ts"], {
          cwd: root,
        })
      : spawnSync(
          process.execPath,
          [ttsxBinary, "--cwd", root, "src/main.ts"],
          { cwd: root, env, encoding: "utf8", windowsHide: true },
        );
  if ("error" in result) assert.equal(result.error, undefined);
  assert.equal(
    result.signal,
    null,
    "runtime layout child terminated by signal",
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "junction-ok");
}
