//go:build e2e

package paths_test

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandRunsCheck verifies the paths sidecar can run a no-emit project check.
//
// The paths sidecar is tested from its package-local command wrapper because the contract is
// path rewriting as observed by a host process. These cases keep alias resolution, command
// parsing, and output writing black-box at the package boundary.
//
// The check branch should validate a project that uses path aliases without writing rewritten
// JavaScript. That separates diagnostic-only host execution from transform and build output
// contracts.
//
// 1. Materialize a project with baseUrl and paths aliases.
// 2. Run check through the package command wrapper.
// 3. Assert success and verify no output directory was written.
// @evidence contracts/testing.md#behavioral-verification The alias fixture runs check --quiet with the paths manifest and must succeed with empty streams while dist does not exist.
// @evidence contracts/testing.md#independent-expectations A diagnostic-only check may resolve aliases but must not emit the configured outDir; the fixture establishes the independently expected absent directory.
// @evidence contracts/testing.md#distinguishing-cases The same import/target shape used by build is accepted without writing dist. This case does not assert rewritten source during check.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRunsCheck entry runs in the paths E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The native check command must load the alias-aware project and return success without entering the emit branch; direct resolver units cannot establish the package command exit and filesystem effect.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one check process over one freshly seeded alias project from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity seedPathsProject (shared.SeedProject) writes the fixture project under t.TempDir, which the test framework removes at cleanup; the single check process exits before dist is stat-ed. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status/stream check and the dist-absence check are made in this body; rewritten source is not asserted during check.
func TestCommandRunsCheck(t *testing.T) {
  // Scenario setup: the shared fixture includes an alias import and target so
  // program loading sees the same configuration used by build mode.
  root := seedPathsProject(t)
  // Check assertion: paths has no diagnostics in a valid project, and --quiet
  // should keep the command-frontdoor output empty.
  code, stdout, stderr := runPlugin(t, "check", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("check branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if _, err := os.Stat(filepath.Join(root, "dist")); !os.IsNotExist(err) {
    t.Fatalf("check branch wrote output directory: %v", err)
  }
}
