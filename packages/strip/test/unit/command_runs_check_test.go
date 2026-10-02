package strip_test

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandRunsCheck verifies the strip command can run a no-emit project check.
//
// The strip command is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// The check branch must accept a real strip manifest while leaving the filesystem untouched.
// That proves command parsing and project loading work without confusing check with build.
//
// 1. Materialize a project containing a removable statement.
// 2. Run check with the strip plugin manifest.
// 3. Assert success and verify no output file was emitted.
// @evidence contracts/testing.md#behavioral-verification Strip check --quiet accepts the default-policy fixture with status zero and empty streams and must not create src/main.js.
// @evidence contracts/testing.md#independent-expectations The diagnostic-only command contract requires no JavaScript emit; the assertion covers the source-adjacent output location rather than all possible writes.
// @evidence contracts/testing.md#distinguishing-cases The removable statements remain only fixture input during check; actual removal is owned by transform/build. This entry distinguishes no-emit success from publication.
// @evidence contracts/testing.md#execution-ownership Unit entry TestCommandRunsCheck is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. It dispatches through utility.RunCommandWithIO, the same entry the standalone sidecar's main delegates to, with invocation-owned buffers and a t.TempDir fixture; no producer binary or child process is built or started. The real compiler-plus-installed-package connection is owned by the strip scenes of tests/test-e2e.
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
