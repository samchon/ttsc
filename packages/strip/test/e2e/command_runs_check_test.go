package strip_test

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandRunsCheck verifies the strip sidecar can run a no-emit project check.
//
// The strip sidecar is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// The check branch must accept a real strip manifest while leaving the filesystem untouched.
// That proves command parsing and project loading work without confusing check with build.
//
// 1. Materialize a project containing a removable statement.
// 2. Run check with the strip plugin manifest.
// 3. Assert success and verify no output file was emitted.
// @evidence contracts/testing.md#behavioral-verification Native strip check --quiet accepts the default-policy fixture with status zero and empty streams and must not create src/main.js.
// @evidence contracts/testing.md#independent-expectations The diagnostic-only command contract requires no JavaScript emit; the assertion covers the source-adjacent output location rather than all possible writes.
// @evidence contracts/testing.md#distinguishing-cases The removable statements remain only fixture input during check; actual removal is owned by transform/build. This entry distinguishes no-emit success from publication.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRunsCheck entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The compiled strip check route loads its manifest and project without taking the emitter path; direct transform units do not prove native exit/no-emit wiring.
// @evidence contracts/e2e.md#shared-execution All strip command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRunsCheck, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRunsCheck inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
func TestCommandRunsCheck(t *testing.T) {
  // Scenario setup: outDir is omitted because check mode must not depend on
  // build output settings.
  root := seedStripProject(t, false)
  // Check assertion: a clean project and default strip config should produce no
  // diagnostics and no command output.
  code, stdout, stderr := runPlugin(t, "check", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+stripManifest(t), "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("check branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if _, err := os.Stat(filepath.Join(root, "src", "main.js")); !os.IsNotExist(err) {
    t.Fatalf("check branch emitted JavaScript: %v", err)
  }
}
