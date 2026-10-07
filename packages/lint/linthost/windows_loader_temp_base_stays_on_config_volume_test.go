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
// @evidence contracts/testing.md#execution-ownership This Windows-constrained Go unit directly invokes the maintained package operation in the owning linthost process over disposable filesystem inputs. Windows supplies aliases and junction fixtures; no installed SDK, source overlay, product build or product host child is required. Fixture-only mklink preparation does not execute the behavior under test.
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
