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
