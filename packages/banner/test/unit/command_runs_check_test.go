package banner_test

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandRunsCheck verifies the banner sidecar can run a no-emit project check.
//
// The banner sidecar command dispatch is intentionally tested through its command front door, in process.
// These cases prove the small wrapper package can parse host commands, hand project work to the
// shared utility host, and place documentation text without relying on tests inside the plugin
// implementation directory.
//
// The check branch loads a real tsconfig and plugin manifest but must not write output files.
// This distinguishes diagnostic-only execution from build and transform behavior.
//
// 1. Materialize a strict TypeScript project and banner manifest.
// 2. Run the check command through the sidecar command dispatch.
// 3. Assert success and verify no JavaScript output was emitted.
//
// @evidence contracts/testing.md#behavioral-verification The strict banner project runs check --quiet with its CJS manifest; status zero, empty streams and absent src/main.js distinguish the no-emit branch.
// @evidence contracts/testing.md#independent-expectations The check contract is successful validation without JavaScript emission; the absence assertion uses the original source location, not every possible output path.
// @evidence contracts/testing.md#distinguishing-cases A valid manifest is loaded without outDir; build owns positive publication and transform owns returned source payload. This case does not assert banner text during check.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRunsCheck unit runs the sidecar command dispatch (utility.RunCommandWithIO with the banner registration) in the Go test process; runPlugin captures its exit status and separate streams. No compiled sidecar binary or child process is started, and the one-line process entry in plugin/main.go is not exercised.
func TestCommandRunsCheck(t *testing.T) {
  // Scenario setup: the project is intentionally minimal because check only
  // needs to prove the dispatch can parse the manifest and load the program.
  root := seedProject(t, map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`,
    "src/main.ts":   `export const value = "ok";` + "\n",
  })

  // Check assertion: no JavaScript should be emitted and no summary should be
  // printed when --quiet is passed through to the utility host.
  code, stdout, stderr := runPlugin(t, "check", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+bannerManifest(t, root, "check banner"), "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("check branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if _, err := os.Stat(filepath.Join(root, "src", "main.js")); !os.IsNotExist(err) {
    t.Fatalf("check branch emitted JavaScript: %v", err)
  }
}
