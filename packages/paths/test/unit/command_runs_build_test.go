package paths_test

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandRunsBuild verifies the paths command rewrites aliases during build emit.
//
// The paths command is tested through its package-local dispatch because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// Build must preserve the compiler output tree while rewriting import specifiers in files on
// disk. The fixture uses an alias import so the assertion covers emitted JavaScript, not only
// command success.
//
// 1. Create an alias-based TypeScript project with outDir.
// 2. Execute build with --emit through the shared command dispatch.
// 3. Assert the emitted JavaScript imports the relative output target.
// @evidence contracts/testing.md#behavioral-verification The alias project runs build --emit --quiet; status and streams are zero/empty, main.js excludes @lib/message and contains require("./lib/message.js").
// @evidence contracts/testing.md#independent-expectations The authored @lib/* to src/lib/* mapping and JS output suffix imply the literal relative runtime import independently of the rewriter.
// @evidence contracts/testing.md#distinguishing-cases This entry checks rewritten JavaScript written to outDir. It does not execute that JS; the paths_rewrites_only_unshadowed_require scene in tests/test-e2e owns runtime preservation and command_runs_transform owns the returned source payload.
// @evidence contracts/testing.md#execution-ownership The named entry is in test/unit and calls utility.RunCommandWithIO, the dispatch the standalone main delegates to, in this Go process with the paths plugin linked by the driver import and a t-owned fixture project; no built binary or child process is started.
func TestCommandRunsBuild(t *testing.T) {
  // Scenario setup: the shared fixture has rootDir/outDir so the utility host
  // can compute the emitted path for both source and target files.
  root := seedPathsProject(t)
  // Build assertion: --quiet keeps command stdout empty; the emitted JS file
  // is the observable contract for the transform.
  code, stdout, stderr := runCommand("build", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--emit", "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("build branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  js := readFile(t, filepath.Join(root, "dist", "main.js"))
  // Output assertion: the authored alias must not leak to runtime output.
  if strings.Contains(js, "@lib/message") || !strings.Contains(js, `require("./lib/message.js")`) {
    t.Fatalf("build output did not rewrite paths:\n%s", js)
  }
}
