package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLoaderTempBaseStaysOnConfigVolume verifies portable loader-temp defaults.
//
// Same-volume and volume-free relative inputs keep the system-temp default.
// Actual cross-volume placement and junction identity belong to the Windows boundary batch.
//
// 1. Create a config origin next to node_modules.
// 2. Assert same-volume and relative config inputs retain the empty default.
//
// @evidence contracts/testing.md#behavioral-verification loaderTempBase returns the empty system-temp default for a same-volume config and for a relative volume-free config, preventing unnecessary project cache creation.
// @evidence contracts/testing.md#independent-expectations The historical temp-placement contract retains the default unless a config and temp location have different volumes; independently authored same-root and relative inputs require the literal empty result.
// @evidence contracts/testing.md#distinguishing-cases Owns same-volume absolute and volume-free relative inputs; TestWindowsLoaderTempBaseStaysOnConfigVolume preserves the differing-volume and kernel-junction branches.
// @evidence contracts/testing.md#execution-ownership This selected Go unit calls loaderTempBase in-process with an authored fixture directory; it launches no host, installation, native artifact or junction command.
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
}
