package strip_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandRunsTransform verifies strip transform output.
//
// Direct utility dispatch applies the registered strip driver and prints the
// resulting TypeScript into a JSON payload in this Go test process. No sidecar
// is started and no emitted JavaScript is used as this case's oracle.
//
// Transform mode is the narrowest host path for receiving mutated TypeScript text. The fixture
// keeps one removable call and one retained statement so the assertion proves selective
// stripping.
//
// 1. Create a source file with a configured strip target.
// 2. Run transform through the production command dispatch.
// 3. Decode the JSON payload and assert removed and retained statements separately.
//
// @evidence contracts/testing.md#behavioral-verification Transform returns nonempty typescript[src/main.ts], removes debugger and console.log, and retains export const value = "ok" with status zero and empty stderr.
// @evidence contracts/testing.md#independent-expectations The default strip targets and authored retained exported value give independent changed/unchanged expectations, rather than snapshotting the plugin result.
// @evidence contracts/testing.md#distinguishing-cases Targets disappear while ordinary code remains. Build covers disk publication; the embedded-statements entry covers additional syntax and non-target call negatives.
// @evidence contracts/testing.md#execution-ownership Unit entry TestCommandRunsTransform is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. It dispatches through utility.RunCommandWithIO, the same entry the standalone sidecar's main delegates to, with invocation-owned buffers and a t.TempDir fixture; no producer binary or child process is built or started. The real compiler-plus-installed-package connection is owned by the strip scenes of tests/test-e2e.
func TestCommandRunsTransform(t *testing.T) {
  // Scenario setup: transform mode observes the in-memory source surface, so no
  // output directory is needed.
  root := seedStripProject(t, false)
  // Transform assertion: the command branch should expose the same in-memory
  // source mutation that build later emits to disk.
  code, stdout, stderr := runPlugin(t, "transform", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+stripManifest(t))
  if code != 0 || stderr != "" {
    t.Fatalf("transform branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var result transformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &result); err != nil {
    t.Fatalf("transform output is not JSON: %v\n%s", err, stdout)
  }
  // Source assertion: the result must include the authored source under the
  // cwd-relative key used by shared utility plugin tests.
  if result.TypeScript["src/main.ts"] == "" {
    t.Fatalf("transform branch did not return project source: %#v", result.TypeScript)
  }
  main := result.TypeScript["src/main.ts"]
  if strings.Contains(main, "debugger") || strings.Contains(main, "console.log") {
    t.Fatalf("transform output was not stripped:\n%s", main)
  }
  if !strings.Contains(main, `export const value = "ok"`) {
    t.Fatalf("transform output did not retain ordinary code:\n%s", main)
  }
}
