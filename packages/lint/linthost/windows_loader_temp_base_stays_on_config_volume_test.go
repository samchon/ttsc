//go:build windows

package linthost

import (
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
)

// TestWindowsLoaderTempBaseStaysOnConfigVolume verifies cross-volume loader placement and junction canonicalization.
//
// Windows volume identity and junction reparse behavior cannot be observed by running POSIX path operations.
//
// 1. Supply a different drive and require a created, canonical node_modules cache.
// 2. Block that cache and verify the config-directory fallback; verify the no-modules fallback when no ambient install is present.
// 3. Create a real junction and require the cache beneath its physical target.
//
// @evidence contracts/testing.md#behavioral-verification loaderTempBase chooses and creates the same-volume cache for a differing fake temp volume, falls back when cache creation is blocked or no node_modules exists, and returns the canonical cache behind a real junction.
// @evidence contracts/testing.md#independent-expectations The authored differing drive, known fixture directories, os.Stat creation result and independent filepath.EvalSymlinks identity establish the expected placement.
// @evidence contracts/testing.md#distinguishing-cases Owns cache creation, blocked-cache fallback, conditionally isolated no-modules fallback and junction target identity; same-volume and relative-path defaults remain in TestLoaderTempBaseStaysOnConfigVolume.
// @evidence contracts/testing.md#execution-ownership TestWindowsLoaderTempBaseStaysOnConfigVolume is a Windows-only Go boundary entry in the setup batch; its source-private operation is executed through the shared Go overlay rather than repeated consumer installs or product builds.
// @evidence contracts/e2e.md#necessary-boundary Actual Windows drive semantics and cmd mklink /J connect the path operation to the kernel; Linux has no drive volume and could not execute the former conditional branch.
// @evidence contracts/e2e.md#shared-execution The Windows kernel cases reuse one Go preparation and process from the setup batch. This case creates only conflicting fixture trees and one junction, with no per-input installation or binary build.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each cache/fallback/junction fixture has a distinct t.TempDir owner; the kernel junction targets an existing directory and canonical identity is observed immediately, with Go cleanup reclaiming all fixtures.
// @evidence contracts/e2e.md#preserved-coverage Transfers every former Windows cross-volume/cache/block/bare/junction assertion unchanged; the original unit retains both same-volume and relative-config empty-default assertions.
func TestWindowsLoaderTempBaseStaysOnConfigVolume(t *testing.T) {
  root := t.TempDir()
  if err := os.MkdirAll(filepath.Join(root, "node_modules"), 0o755); err != nil {
    t.Fatal(err)
  }
  config := filepath.Join(root, "lint.config.ts")
  fake := `Z:\ttsc-fake-temp`
  if strings.EqualFold(filepath.VolumeName(root), "Z:") {
    fake = `Y:\ttsc-fake-temp`
  }
  if filepath.VolumeName(fake) == "" {
    // No volume concept on this platform; the cross-volume branch is
    // unreachable by construction.
    return
  }
  base := loaderTempBase(config, fake)
  // Normalize the expectation the same way the helper normalizes its result:
  // EvalSymlinks also expands 8.3 short names (CI runners hand out a
  // RUNNER~1-style TEMP), so a raw Join of the fixture root won't compare
  // equal even though both name the same directory.
  crossWant, crossErr := filepath.EvalSymlinks(filepath.Join(root, "node_modules", ".cache"))
  if crossErr != nil {
    t.Fatal(crossErr)
  }
  if base != crossWant {
    t.Fatalf("cross-volume base mismatch: %q != %q", base, crossWant)
  }
  if stat, err := os.Stat(base); err != nil || !stat.IsDir() {
    t.Fatalf("cross-volume base was not created: %v", err)
  }
  // A file squatting on node_modules/.cache blocks the cache dir; the
  // config's own directory is still on the right volume, unlike the system
  // temp dir which is guaranteed to fail.
  blockedRoot := t.TempDir()
  if err := os.MkdirAll(filepath.Join(blockedRoot, "node_modules"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(blockedRoot, "node_modules", ".cache"), nil, 0o644); err != nil {
    t.Fatal(err)
  }
  if base := loaderTempBase(filepath.Join(blockedRoot, "lint.config.ts"), fake); base != blockedRoot {
    t.Fatalf("blocked-cache base mismatch: %q != %q", base, blockedRoot)
  }
  // Same fallback without any node_modules. Guarded: a stray node_modules
  // above the test temp dir would legitimately route to its .cache.
  bare := t.TempDir()
  if findNearestNodeModules(bare) == "" {
    if base := loaderTempBase(filepath.Join(bare, "lint.config.ts"), fake); base != bare {
      t.Fatalf("no-node_modules base mismatch: %q != %q", base, bare)
    }
  }
  // Junction node_modules (privilege-free on Windows, and this section only
  // runs on drive-letter platforms).
  linkedRoot := t.TempDir()
  realModules := filepath.Join(linkedRoot, "real-modules")
  project := filepath.Join(linkedRoot, "project")
  for _, dir := range []string{realModules, project} {
    if err := os.MkdirAll(dir, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  junction := filepath.Join(project, "node_modules")
  if out, err := exec.Command("cmd", "/c", "mklink", "/J", junction, realModules).CombinedOutput(); err != nil {
    t.Fatalf("mklink /J failed: %v: %s", err, out)
  }
  base = loaderTempBase(filepath.Join(project, "lint.config.ts"), fake)
  want, err := filepath.EvalSymlinks(filepath.Join(realModules, ".cache"))
  if err != nil {
    t.Fatal(err)
  }
  if base != want {
    t.Fatalf("junction base mismatch: %q != %q", base, want)
  }
}
