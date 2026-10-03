import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ensureExecutableGoToolchain } from "../../../../../packages/ttsc/src/plugin/internal/source/ensureExecutableGoToolchain";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies owned and selected toolchains retain their distinct permission
 * policy.
 *
 * 1. Author a nonexecutable tool and normalize its owned mode to 0755.
 * 2. Restore 0666 and require only owner execution for a selected tool.
 * 3. Keep an already executable selected mode unchanged on the warm call.
 * 4. Reject directory inputs without changing their modes or sentinel bytes,
 *    including a gofmt directory beside a recognized SDK's ordinary go file.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source permission repair changes the real authored file to the original 0755 and 0766 expectations, then preserves 0700. Authored go and SDK gofmt directories must retain their kind, mode and sentinel bytes while an SDK's ordinary go file still receives the selected policy.
 * @evidence contracts/testing.md#independent-expectations Literal original permission masks and authored inert tool files independently establish the owned-versus-selected outcomes. Directory masks 0700/0600 and sentinel bytes must remain unchanged because permission repair admits regular executable files; the SDK fixture explicitly supplies bin/go and src/runtime without executing metadata discovery.
 * @evidence contracts/testing.md#distinguishing-cases Owned normalization, selected nonexecutable repair and selected already executable preservation remain separate cases. POSIX directory twins use 0700 for owned normalization and 0600 for selected nonexecutable input, contrasting with regular files; recognized SDK layout reaches the gofmt kind boundary. Windows has no POSIX mode contract, so its existing early-return population asserts the documented no-op for writable/read-only tools rather than claiming directory-mode coverage.
 * @evidence contracts/testing.md#execution-ownership This source unit invokes actual permission repair with native stat/chmod and no compiler or metadata subprocess. Its POSIX directory counterparts observe file-kind admission only; builder call order and successful native build integration are outside this body's assertions.
 */
export function test_source_toolchain_permissions_preserve_owned_and_selected_modes(): void {
  if (process.platform === "win32") {
    // Windows has no execute bit: the repair is documented to do nothing there.
    // Windows reports 0o666 for a writable file and 0o444 for a read-only one,
    // so a repair that wrongly chmod-ed would visibly rewrite the file.
    const windowsRoot = TestProject.tmpdir("ttsc-toolchain-permissions-source-");
    const windowsTool = path.join(windowsRoot, "go.exe");
    fs.writeFileSync(windowsTool, "authored executable bytes\n");
    for (const mode of [0o666, 0o444]) {
      fs.chmodSync(windowsTool, mode);
      const before = fs.statSync(windowsTool).mode & 0o7777;
      for (const owned of [true, false]) {
        ensureExecutableGoToolchain(windowsTool, owned);
        assert.equal(
          fs.statSync(windowsTool).mode & 0o7777,
          before,
          `windows keeps a ${before.toString(8)} tool unchanged (owned=${owned})`,
        );
      }
    }
    fs.chmodSync(windowsTool, 0o666);
    assert.equal(
      fs.readFileSync(windowsTool, "utf8"),
      "authored executable bytes\n",
    );
    return;
  }
  const root = TestProject.tmpdir("ttsc-toolchain-permissions-source-");
  const tool = path.join(root, "go");
  fs.writeFileSync(tool, "authored executable bytes\n");
  fs.chmodSync(tool, 0o666);
  ensureExecutableGoToolchain(tool, true);
  assert.equal(fs.statSync(tool).mode & 0o7777, 0o755);
  fs.chmodSync(tool, 0o666);
  ensureExecutableGoToolchain(tool, false);
  assert.equal(fs.statSync(tool).mode & 0o7777, 0o766);
  fs.chmodSync(tool, 0o700);
  ensureExecutableGoToolchain(tool, false);
  assert.equal(fs.statSync(tool).mode & 0o7777, 0o700);
  assert.equal(fs.readFileSync(tool, "utf8"), "authored executable bytes\n");

  const failures: Error[] = [];
  for (const owned of [true, false]) {
    for (const kind of ["go", "gofmt"] as const) {
      const directoryRoot = path.join(root, `${kind}-${owned}`);
      const candidate = kind === "go"
        ? path.join(directoryRoot, "go")
        : path.join(directoryRoot, "bin", "gofmt");
      fs.mkdirSync(candidate, { recursive: true });
      const sentinel = path.join(candidate, "sentinel.txt");
      fs.writeFileSync(sentinel, "directory sentinel\n");
      const binary = kind === "go"
        ? candidate
        : path.join(directoryRoot, "bin", "go");
      if (kind === "gofmt") {
        fs.mkdirSync(path.join(directoryRoot, "src", "runtime"), { recursive: true });
        fs.writeFileSync(binary, "inert SDK go bytes\n");
        fs.chmodSync(binary, 0o666);
      }
      const mode = owned ? 0o700 : 0o600;
      fs.chmodSync(candidate, mode);
      try {
        assert.equal(fs.statSync(candidate).isDirectory(), true);
        assert.equal(fs.statSync(candidate).mode & 0o7777, mode);
        ensureExecutableGoToolchain(binary, owned);
        assert.equal(fs.statSync(candidate).isDirectory(), true);
        assert.equal(fs.statSync(candidate).mode & 0o7777, mode);
        if (kind === "gofmt") {
          assert.equal(fs.statSync(binary).isFile(), true);
          assert.equal(fs.statSync(binary).mode & 0o7777, owned ? 0o755 : 0o766);
          assert.equal(fs.readFileSync(binary, "utf8"), "inert SDK go bytes\n");
        }
      } catch (error) {
        failures.push(new Error(`${kind} directory (owned=${owned})`, { cause: error }));
      } finally {
        // Restore traversal permission only after observing the directory mode.
        fs.chmodSync(candidate, 0o700);
      }
      try {
        assert.equal(fs.readFileSync(sentinel, "utf8"), "directory sentinel\n");
      } catch (error) {
        failures.push(new Error(`${kind} sentinel (owned=${owned})`, { cause: error }));
      }
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "toolchain directory admission assertions");
}
