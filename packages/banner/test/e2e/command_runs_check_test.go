//go:build e2e

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
//
// @evidence contracts/testing.md#behavioral-verification The strict banner project runs check --quiet with its CJS manifest; status zero, empty streams and absent src/main.js distinguish the no-emit branch.
// @evidence contracts/testing.md#independent-expectations The check contract is successful validation without JavaScript emission; the absence assertion uses the original source location, not every possible output path.
// @evidence contracts/testing.md#distinguishing-cases A valid manifest is loaded without outDir; build owns positive publication and transform owns returned source payload. This case does not assert banner text during check.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRunsCheck entry runs in the banner E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The native check dispatch loads the project and banner manifest while returning silent success and leaving the asserted output absent. It verifies no-emit command wiring, not banner transformation semantics.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one check process over one freshly seeded project from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity seedProject writes the fixture project under t.TempDir, which the test framework removes at cleanup; the single check process exits before src/main.js is stat-ed. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status/stream check and the src/main.js absence check are made in this body; banner text is not asserted here and no assertion is delegated elsewhere.
func TestCommandRunsCheck(t *testing.T) {
  // Scenario setup: the project is intentionally minimal because check only
  // needs to prove the sidecar can parse the manifest and load the program.
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
