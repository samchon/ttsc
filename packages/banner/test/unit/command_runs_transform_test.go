package banner_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandRunsTransform verifies the banner sidecar returns transformed project source.
//
// The banner sidecar command dispatch is intentionally tested through its command front door, in process.
// These cases prove the small wrapper package can parse host commands, hand project work to the
// shared utility host, and place documentation text without relying on tests inside the plugin
// implementation directory.
//
// Transform returns changed TypeScript sources through stdout rather than writing
// emitted files. This project contains one source, so the case pins transport and
// banner insertion without claiming a separate file-selection option.
//
// 1. Create a project containing one source file and a banner manifest.
// 2. Run the project transform with the banner manifest.
// 3. Decode the JSON payload, assert the banner and its source completeness declaration.
//
// @evidence contracts/testing.md#behavioral-verification The real banner transform command returns parseable JSON and status zero with empty stderr; typescript[src/main.ts] contains transform banner. The actual SourcePreamble completeness declaration reaches TransformDependenciesFor and the envelope as exactly src/main.ts, with no per-file dependency edges.
// @evidence contracts/testing.md#independent-expectations The authored config text and sole cwd-relative source key define the expected transport and completeness results; substring matching does not pin complete JSDoc or emitted JavaScript. Banner config inputs are universal host inputs, not invented per-file edges.
// @evidence contracts/testing.md#distinguishing-cases This case owns returned TypeScript source and the actual linked banner declaration rather than disk emit or a synthetic contributor. The existing one-Program invocation supplies both observations, does not pass --file and does not prove single-file targeting or multi-plugin completeness intersection.
// @evidence contracts/testing.md#execution-ownership TestCommandRunsTransform calls utility.RunCommandWithIO in the Go test process, but its CJS config starts the real Node loader. No compiled sidecar entry runs. This remaining executable-config boundary belongs in the shared TypeScript E2E population; the existing case retains its assertions until that owner verifies their transfer, while JSON config can isolate portable command dispatch.
func TestCommandRunsTransform(t *testing.T) {
  // Scenario setup: transform mode returns in-memory source text, so the test
  // does not need outDir or emitted files.
  root := seedProject(t, map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`,
    "src/main.ts":   `export const value = "ok";` + "\n",
  })

  // Transform assertion: stdout is the command contract here, and the banner
  // must already be visible before JavaScript emit.
  code, stdout, stderr := runPlugin(t, "transform", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+bannerManifest(t, root, "transform banner"))
  if code != 0 || stderr != "" {
    t.Fatalf("transform branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var result struct {
    TypeScript           map[string]string   `json:"typescript"`
    Dependencies         map[string][]string `json:"dependencies"`
    DependenciesComplete []string            `json:"dependenciesComplete"`
  }
  if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &result); err != nil {
    t.Fatalf("transform output is not JSON: %v\n%s", err, stdout)
  }
  // Source assertion: the key is relative to project cwd, matching the shared
  // utility transform result contract used by ttsc.
  if !strings.Contains(result.TypeScript["src/main.ts"], "transform banner") {
    t.Fatalf("transform output missing banner: %#v", result.TypeScript)
  }
  if len(result.DependenciesComplete) != 1 || result.DependenciesComplete[0] != "src/main.ts" {
    t.Fatalf("actual banner completeness=%#v, want exactly src/main.ts", result.DependenciesComplete)
  }
  if len(result.Dependencies) != 0 {
    t.Fatalf("banner config inputs must not become per-file dependency edges: %#v", result.Dependencies)
  }
}
