//go:build e2e

package paths_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandRunsTransform verifies the paths sidecar rewrites project sources in transform mode.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// Transform mode returns TypeScript source text after in-memory source mutations. This checks
// the host-facing JSON payload rather than internal resolver helpers or build-only emitted
// JavaScript.
//
// 1. Create a project whose source imports through an alias.
// 2. Run transform through the real sidecar.
// 3. Decode the JSON payload and assert the alias became a relative runtime import.
// @evidence contracts/testing.md#behavioral-verification Native transform returns JSON containing nonempty src/main.ts and src/lib/message.ts entries; main excludes @lib/message and includes ./lib/message.js, with status zero and empty stderr.
// @evidence contracts/testing.md#independent-expectations The fixture alias mapping, source keys and emitted .js import target give literal expectations; they are not taken from the returned resolver state.
// @evidence contracts/testing.md#distinguishing-cases Both importer and target must survive the payload, and the alias must change. Build owns disk output; the broader specifier case owns unaffected call forms.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRunsTransform entry runs in the paths E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The compiled paths plugin must attach to the compiler and return cwd-relative transformed sources in the utility JSON protocol; correct direct rewriter output alone cannot prove this payload connection.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one transform process over one freshly seeded alias project from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity seedPathsProject (shared.SeedProject) writes the fixture project under t.TempDir, which the test framework removes at cleanup; the single transform process exits before stdout is decoded. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status/stderr check (L38), JSON decode (L42), both-source presence (L47) and alias-rewrite check on src/main.ts (L51) are made in this body.
func TestCommandRunsTransform(t *testing.T) {
  // Scenario setup: transform mode does not write to disk, so the project only
  // needs enough structure to load and expose source files.
  root := seedPathsProject(t)
  // Transform assertion: the command contract is the JSON source map returned
  // on stdout after the same source mutation used by build mode.
  code, stdout, stderr := runPlugin(t, "transform", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t))
  if code != 0 || stderr != "" {
    t.Fatalf("transform branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var result transformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &result); err != nil {
    t.Fatalf("transform output is not JSON: %v\n%s", err, stdout)
  }
  // Source assertion: both importer and target source should be present under
  // cwd-relative keys.
  if result.TypeScript["src/main.ts"] == "" || result.TypeScript["src/lib/message.ts"] == "" {
    t.Fatalf("transform branch did not return project sources: %#v", result.TypeScript)
  }
  main := result.TypeScript["src/main.ts"]
  if strings.Contains(main, "@lib/message") || !strings.Contains(main, `"./lib/message.js"`) {
    t.Fatalf("transform output did not rewrite paths:\n%s", main)
  }
}
