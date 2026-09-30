package paths_test

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandRunsBuild verifies the paths sidecar rewrites aliases during build emit.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// Build must preserve the compiler output tree while rewriting import specifiers in files on
// disk. The fixture uses an alias import so the assertion covers emitted JavaScript, not only
// command success.
//
// 1. Create an alias-based TypeScript project with outDir.
// 2. Execute build with --emit through the real sidecar.
// 3. Assert the emitted JavaScript imports the relative output target.
// @evidence contracts/testing.md#behavioral-verification The alias project runs native build --emit --quiet; status and streams are zero/empty, main.js excludes @lib/message and contains require("./lib/message.js").
// @evidence contracts/testing.md#independent-expectations The authored @lib/* to src/lib/* mapping and JS output suffix imply the literal relative runtime import independently of the rewriter.
// @evidence contracts/testing.md#distinguishing-cases This entry checks rewritten JavaScript written to outDir. It does not execute that JS; unshadowed-require owns runtime preservation and transform owns source-map transport.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRunsBuild entry runs in the paths E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The paths sidecar must connect compiler alias resolution and source rewriting to the actual emit tree; direct path calculations cannot detect discarded emitted edits.
// @evidence contracts/e2e.md#shared-execution All paths command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRunsBuild, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRunsBuild inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
func TestCommandRunsBuild(t *testing.T) {
  // Scenario setup: the shared fixture has rootDir/outDir so the utility host
  // can compute the emitted path for both source and target files.
  root := seedPathsProject(t)
  // Build assertion: --quiet keeps command stdout empty; the emitted JS file
  // is the observable contract for the transform.
  code, stdout, stderr := runPlugin(t, "build", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--emit", "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("build branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  js := readFile(t, filepath.Join(root, "dist", "main.js"))
  // Output assertion: the authored alias must not leak to runtime output.
  if strings.Contains(js, "@lib/message") || !strings.Contains(js, `require("./lib/message.js")`) {
    t.Fatalf("build output did not rewrite paths:\n%s", js)
  }
}
