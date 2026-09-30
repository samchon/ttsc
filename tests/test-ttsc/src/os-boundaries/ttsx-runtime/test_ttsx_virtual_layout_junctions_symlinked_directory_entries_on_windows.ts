import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx mirrors linked node_modules and executes junction-ok with zero status, detecting privileged re-symlink failure in virtual layout.
 * @evidence contracts/testing.md#independent-expectations Authored literal junction-ok and lstat proof of a real link establish independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases Windows uses an actual junction and POSIX a directory symlink; file-link fallback has separate units and boundary.
 * @evidence contracts/testing.md#execution-ownership This named OS-boundary entry owns one real native directory link/launcher request. The installed matrix runner passes its installed candidate launcher; direct local calls default to the workspace launcher.
 * @evidence contracts/e2e.md#necessary-boundary Real link topology must survive prepareExecution and Node assembly; direct linkVirtualEntry calls do not certify that connection.
 * @evidence contracts/e2e.md#shared-execution One project/linked directory/host covers the topology in the shared installed matrix preparation; no per-assertion installation, build or host is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Isolated tracked immutable target/root remain alive through synchronous host completion, before cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original link check, zero status and junction-ok remain with native platform link types, now owned by the installed OS batch rather than the repeated portable feature population.
 */
export function test_ttsx_virtual_layout_junctions_symlinked_directory_entries_on_windows(
  ttsxBinary: string = TestProject.TTSX_BIN,
) {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts": `const message: string = "junction-ok";\nconsole.log(message);\n`,
    });
    const linkedModules = TestProject.tmpdir("ttsx-linked-node-modules-");
    const nodeModules = path.join(root, "node_modules");
    fs.symlinkSync(
      linkedModules,
      nodeModules,
      process.platform === "win32" ? "junction" : undefined,
    );
    assert.equal(fs.lstatSync(nodeModules).isSymbolicLink(), true);

    const result = TestProject.spawn(
      ttsxBinary,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "junction-ok");
  }
