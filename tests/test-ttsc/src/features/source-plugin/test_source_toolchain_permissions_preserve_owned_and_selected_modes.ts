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
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source permission repair changes the real authored file to the original 0755 and 0766 expectations, then preserves 0700.
 * @evidence contracts/testing.md#independent-expectations Literal original permission masks and an authored tool file independently establish the owned-versus-selected outcomes.
 * @evidence contracts/testing.md#distinguishing-cases Owned normalization, selected nonexecutable repair and selected already executable preservation remain separate cases; Windows returns false because the POSIX mode contract is unavailable.
 * @evidence contracts/testing.md#execution-ownership This source unit invokes actual permission repair with native stat/chmod and no compiler or metadata subprocess. Builder call-order review preserves repair before metadata, and the canonical native publication separately owns successful build integration.
 */
export function test_source_toolchain_permissions_preserve_owned_and_selected_modes():
  | void
  | false {
  if (process.platform === "win32") return false;
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
}
