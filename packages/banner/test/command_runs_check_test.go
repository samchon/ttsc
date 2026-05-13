package banner_test

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandRunsCheck verifies the banner sidecar can run a no-emit project check.
//
// The banner sidecar is intentionally tested through its package-local command front door.
// These cases prove the small wrapper package can parse host commands, hand project work to the
// shared utility host, and place documentation text without relying on tests inside the plugin
// implementation directory.
//
// The check branch loads a real tsconfig and plugin manifest but must not write output files.
// This distinguishes diagnostic-only execution from build and transform behavior.
//
// 1. Materialize a strict TypeScript project and banner manifest.
// 2. Run the check command through the real sidecar.
// 3. Assert success and verify no JavaScript output was emitted.
func TestCommandRunsCheck(t *testing.T) {
  // Scenario setup: the project is intentionally minimal because check only
  // needs to prove the sidecar can parse the manifest and load the program.
  root := seedProject(t, map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`,
    "src/main.ts":   `export const value = "ok";` + "\n",
  })

  // Check assertion: no JavaScript should be emitted and no summary should be
  // printed when --quiet is passed through to the utility host.
  code, stdout, stderr := runPlugin(t, "check", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+bannerManifest(t, "check banner"), "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("check branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if _, err := os.Stat(filepath.Join(root, "src", "main.js")); !os.IsNotExist(err) {
    t.Fatalf("check branch emitted JavaScript: %v", err)
  }
}
