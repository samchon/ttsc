package linthost

import (
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
)

// TestLoaderTempBaseStaysOnConfigVolume verifies the config-loader temp-dir
// base follows the config file's volume.
//
// When the system temp dir shares the config's volume, the historical default
// ("" — os.MkdirTemp's system temp) must be kept. When it does not
// (drive-letter platforms: TEMP on C:, project on D:), the loader must move
// under the config's nearest node_modules/.cache — a cross-volume loader can
// neither express a tsconfig rootDir spanning both inputs nor a relative
// import of the config (#305).
//
//  1. Materialize a config next to a node_modules directory.
//  2. Same-volume systemTemp → expect the "" default.
//  3. Fake a systemTemp on another volume (drive-letter platforms only) →
//     expect node_modules/.cache on the config's volume, created on disk.
//  4. Block node_modules/.cache with a file → expect the config's directory.
//  5. No node_modules at all → expect the config's directory.
//  6. A junction node_modules → expect the realpath of its .cache (the ESM
//     runtime realpaths the loader at import time, so a link-form base breaks
//     the relative config import).
func TestLoaderTempBaseStaysOnConfigVolume(t *testing.T) {
  root := t.TempDir()
  if err := os.MkdirAll(filepath.Join(root, "node_modules"), 0o755); err != nil {
    t.Fatal(err)
  }
  config := filepath.Join(root, "lint.config.ts")
  if base := loaderTempBase(config, root); base != "" {
    t.Fatalf("same-volume base mismatch: %q", base)
  }
  // A relative location has no volume and must keep the historical default,
  // not be mistaken for a cross-volume config.
  if base := loaderTempBase("lint.config.ts", root); base != "" {
    t.Fatalf("relative-location base mismatch: %q", base)
  }
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
