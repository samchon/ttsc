package strip_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandRunsTransform verifies strip transform output.
//
// The strip sidecar is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// Transform mode is the narrowest host path for receiving mutated TypeScript text. The fixture
// keeps one removable call and one retained statement so the assertion proves selective
// stripping.
//
// 1. Create a source file with a configured strip target.
// 2. Run transform through the real sidecar.
// 3. Decode the JSON payload and assert removed and retained statements separately.
// @evidence contracts/testing.md#behavioral-verification Native transform returns nonempty typescript[src/main.ts], removes debugger and console.log, and retains export const value = "ok" with status zero and empty stderr.
// @evidence contracts/testing.md#independent-expectations The default strip targets and authored retained exported value give independent changed/unchanged expectations, rather than snapshotting the plugin result.
// @evidence contracts/testing.md#distinguishing-cases Targets disappear while ordinary code remains. Build covers disk publication; the embedded-statements entry covers additional syntax and non-target call negatives.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRunsTransform entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The real strip registration and compiler must serialize the selectively changed source in the utility stdout payload; direct AST removal does not prove the host-facing source map.
// @evidence contracts/e2e.md#shared-execution All strip command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRunsTransform, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRunsTransform inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
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
