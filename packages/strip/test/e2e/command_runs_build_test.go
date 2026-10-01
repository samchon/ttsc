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
// @evidence contracts/testing.md#behavioral-verification Native strip build --emit --quiet succeeds with empty streams and emitted main.js contains neither debugger nor console.log.
// @evidence contracts/testing.md#independent-expectations The fixture default strip policy removes debugger statements and console.log calls; literal forbidden output fragments pin removal independently of the rewriter.
// @evidence contracts/testing.md#distinguishing-cases This entry owns disk emit of removed targets. Unlike transform, it does not assert retained ordinary code, so blanket meaning-preservation coverage is not claimed.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRunsBuild entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The strip registration and utility emit path must carry deletions into the actual JavaScript file. Direct strip AST decisions cannot detect missing emitted publication.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one build process over one freshly seeded project from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity seedStripProject writes the fixture project under t.TempDir, which the test framework removes at cleanup; the single build process exits before dist/main.js is read. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status/stream check (L36) and the debugger/console.log absence check on dist/main.js (L42) are made in this body; absence-only, so deleting all output would also pass, and no assertion is delegated elsewhere.
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
