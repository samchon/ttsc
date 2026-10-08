import assert from "node:assert/strict";

import { matchesObservedProcessCommand } from "../../../../utils/src/matchesObservedProcessCommand";

/**
 * Verifies process admission compares the complete selected command.
 *
 * Darwin's truncated comm field cannot identify a Go executable. Only its
 * full displayed command can match the independently selected argument vector.
 *
 * 1. Match POSIX full paths and Windows executable paths containing spaces.
 * 2. Reject similar executable prefixes, changed arguments and missing data.
 * 3. Keep quoting and path spelling tied to the explicit listing platform.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the maintained command predicate directly for full POSIX and Windows representations, asserting exact executable and argument equality without using a comm basename.
 * @evidence contracts/testing.md#independent-expectations Authored selected argv and literal process-listing strings define the expected command. Different executable paths or argument bytes cannot authorize the selected build.
 * @evidence contracts/testing.md#distinguishing-cases Darwin-style truncated-name circumstances use a full command, paths with spaces contrast quoted and unquoted Windows displays, and near-prefix executables, changed arguments, case changes, leading quotes on POSIX, null and empty argv are rejected independently.
 * @evidence contracts/testing.md#execution-ownership One discoverable same-process unit calls the shared test helper with literal strings and starts no process, compiler or installed consumer. Real OS listing and original-generation/parent/source binding remain in the maintained cold Graph boundary scenario.
 */
export function test_observed_process_commands_require_exact_executable_and_arguments(): void {
  const posix = ["/Users/runner/work/ttsc/ttsc/packages/ttsc-darwin-arm64/bin/go/bin/go", "build", "-trimpath", "-o", ".ttsc-plugin.exe", "./plugin"];
  const command = "/Users/runner/work/ttsc/ttsc/packages/ttsc-darwin-arm64/bin/go/bin/go build -trimpath -o .ttsc-plugin.exe ./plugin";
  assert.equal(matchesObservedProcessCommand(command, posix, "darwin"), true);
  assert.equal(matchesObservedProcessCommand(command, posix, "linux"), true);
  assert.equal(matchesObservedProcessCommand("/Users/runner/wo", posix, "darwin"), false);
  assert.equal(matchesObservedProcessCommand("/opt/Go Tools/bin/go build ./plugin", ["/opt/Go Tools/bin/go", "build", "./plugin"], "darwin"), true);
  const windows = ["C:\\Program Files\\Go\\bin\\go.exe", "build", "./plugin"];
  assert.equal(matchesObservedProcessCommand('"C:\\Program Files\\Go\\bin\\go.exe" build ./plugin', windows, "win32"), true);
  assert.equal(matchesObservedProcessCommand("C:\\Program Files\\Go\\bin\\go.exe build ./plugin", windows, "win32"), true);
  assert.equal(matchesObservedProcessCommand('"C:\\Program Files\\Go\\bin\\go.exe" build ./plugin', windows, "linux"), false);
  assert.equal(matchesObservedProcessCommand(command.replace("/bin/go build", "/bin/go-other build"), posix, "darwin"), false);
  assert.equal(matchesObservedProcessCommand(command.replace("./plugin", "./other"), posix, "darwin"), false);
  assert.equal(matchesObservedProcessCommand(command.replace("/Users/", "/users/"), posix, "darwin"), false);
  assert.equal(matchesObservedProcessCommand('"' + command + '"', posix, "darwin"), false);
  assert.equal(matchesObservedProcessCommand(null, posix, "darwin"), false);
  assert.equal(matchesObservedProcessCommand("", [], "darwin"), false);
}
