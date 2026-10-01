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
// @evidence contracts/e2e.md#necessary-boundary The strip registration and the host transform must carry the selectively changed source through the stdout JSON payload; direct rewriter calls cannot show that the compiled sidecar serializes it under the src/main.ts key.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one transform process over one freshly seeded project from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity seedStripProject writes the fixture project under t.TempDir, which the test framework removes at cleanup; the single transform process exits before stdout is decoded. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status/stderr check (L38), JSON decode (L42), non-empty source (L47), stripped-fragment absence (L51) and retained-export presence (L54) are all made in this body; stdout is not asserted beyond decoding.
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
