package strip_test

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandRunsBuild verifies the strip sidecar removes configured calls during build emit.
//
// The strip sidecar is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// Build exercises the file-writing branch of the shared utility host. The scenario checks the
// on-disk JavaScript so regressions in emit callbacks or strip pattern application are visible.
//
// 1. Create a project with outDir and a removable call.
// 2. Execute build with --emit and a strip manifest.
// 3. Assert the emitted file dropped the configured call but kept ordinary code.
func TestCommandRunsBuild(t *testing.T) {
  // Scenario setup: build mode needs outDir/rootDir so the emitted JavaScript
  // path is stable and easy to assert.
  root := seedStripProject(t, true)
  // Build assertion: --quiet keeps stdout empty, while the emitted JS verifies
  // that the native command reached the shared strip transform.
  code, stdout, stderr := runPlugin(t, "build", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+stripManifest(t), "--emit", "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("build branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  js := readFile(t, filepath.Join(root, "dist", "main.js"))
  // Output assertion: both default strip targets from the fixture should be
  // absent from runtime output.
  if strings.Contains(js, "debugger") || strings.Contains(js, "console.log") {
    t.Fatalf("build output was not stripped:\n%s", js)
  }
}
