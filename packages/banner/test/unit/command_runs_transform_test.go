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
// 3. Decode the JSON payload and assert the returned TypeScript contains the banner.
//
// @evidence contracts/testing.md#behavioral-verification The real banner transform command returns parseable JSON and status zero with empty stderr; typescript[src/main.ts] must contain transform banner.
// @evidence contracts/testing.md#independent-expectations The authored config text and cwd-relative source key define the expected transport result; substring matching does not pin complete JSDoc or emitted JavaScript.
// @evidence contracts/testing.md#distinguishing-cases This case owns returned TypeScript source rather than disk emit; the invocation does not pass --file and does not prove single-file targeting.
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
  var result transformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &result); err != nil {
    t.Fatalf("transform output is not JSON: %v\n%s", err, stdout)
  }
  // Source assertion: the key is relative to project cwd, matching the shared
  // utility transform result contract used by ttsc.
  if !strings.Contains(result.TypeScript["src/main.ts"], "transform banner") {
    t.Fatalf("transform output missing banner: %#v", result.TypeScript)
  }
}
