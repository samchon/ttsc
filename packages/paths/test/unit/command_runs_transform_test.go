package paths_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandRunsTransform verifies the paths command rewrites project sources in transform mode.
//
// The paths command is tested through its package-local dispatch because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// Transform mode returns TypeScript source text after in-memory source mutations. This checks
// the host-facing JSON payload rather than internal resolver helpers or build-only emitted
// JavaScript.
//
// 1. Create a project whose source imports through an alias.
// 2. Run transform through the shared command dispatch.
// 3. Decode the JSON payload and assert the alias became a relative runtime import.
// @evidence contracts/testing.md#behavioral-verification Native transform returns JSON containing nonempty src/main.ts and src/lib/message.ts entries; main excludes @lib/message and includes ./lib/message.js, with status zero and empty stderr.
// @evidence contracts/testing.md#independent-expectations The fixture alias mapping, source keys and emitted .js import target give literal expectations; they are not taken from the returned resolver state.
// @evidence contracts/testing.md#distinguishing-cases Both importer and target must survive the payload, and the alias must change. Build owns disk output; the broader specifier case owns unaffected call forms.
// @evidence contracts/testing.md#execution-ownership The named entry is in test/unit and calls utility.RunCommandWithIO, the dispatch the standalone main delegates to, in this Go process with the paths plugin linked by the driver import and a t-owned fixture project; no built binary or child process is started.
func TestCommandRunsTransform(t *testing.T) {
  // Scenario setup: transform mode does not write to disk, so the project only
  // needs enough structure to load and expose source files.
  root := seedPathsProject(t)
  // Transform assertion: the command contract is the JSON source map returned
  // on stdout after the same source mutation used by build mode.
  code, stdout, stderr := runCommand("transform", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t))
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
