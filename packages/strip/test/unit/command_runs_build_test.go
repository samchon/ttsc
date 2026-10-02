package strip_test

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandRunsBuild verifies the strip command removes configured calls during build emit.
//
// The strip command is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// Build exercises the file-writing branch of the shared utility host. The scenario checks the
// on-disk JavaScript so regressions in emit callbacks or strip pattern application are visible.
//
// 1. Create a project with outDir and a removable call.
// 2. Execute build with --emit and a strip manifest.
// 3. Assert the emitted file dropped the configured call but kept ordinary code.
// @evidence contracts/testing.md#behavioral-verification Strip build --emit --quiet succeeds with empty streams and emitted main.js contains neither debugger nor console.log.
// @evidence contracts/testing.md#independent-expectations The fixture default strip policy removes debugger statements and console.log calls; literal forbidden output fragments pin removal independently of the rewriter.
// @evidence contracts/testing.md#distinguishing-cases This entry owns disk emit of removed targets. The retained exported literal guards against emptied output; broader meaning preservation is owned by the transform and linked-program cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestCommandRunsBuild is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. It dispatches through utility.RunCommandWithIO, the same entry the standalone sidecar's main delegates to, with invocation-owned buffers and a t.TempDir fixture; no producer binary or child process is built or started. The real compiler-plus-installed-package connection is owned by the strip scenes of tests/test-e2e.
func TestCommandRunsBuild(t *testing.T) {
  // Scenario setup: build mode needs outDir/rootDir so the emitted JavaScript
  // path is stable and easy to assert.
  root := seedStripProject(t, true)
  // Build assertion: --quiet keeps stdout empty, while the emitted JS verifies
  // that the command reached the shared strip transform.
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
  if !strings.Contains(js, `"ok"`) {
    t.Fatalf("build output lost the retained export:\n%s", js)
  }
}
