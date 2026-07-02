package linthost

import (
  "os"
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
func TestLoaderTempBaseStaysOnConfigVolume(t *testing.T) {
  root := t.TempDir()
  if err := os.MkdirAll(filepath.Join(root, "node_modules"), 0o755); err != nil {
    t.Fatal(err)
  }
  config := filepath.Join(root, "lint.config.ts")
  if base := loaderTempBase(config, root); base != "" {
    t.Fatalf("same-volume base mismatch: %q", base)
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
  expected := filepath.Join(root, "node_modules", ".cache")
  if base != expected {
    t.Fatalf("cross-volume base mismatch: %q != %q", base, expected)
  }
  if stat, err := os.Stat(base); err != nil || !stat.IsDir() {
    t.Fatalf("cross-volume base was not created: %v", err)
  }
}
