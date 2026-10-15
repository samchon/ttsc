package strip_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestConfigLoaderIdentityScratchPreservesProjectRoot verifies that the strip
// loader creates temporary files inside a preexisting identity directory when
// TEMP is on another drive or contains the config, while unavailable stores retain the old base.
//
// 1. Create a project, its legacy cache, and a separate opened record store.
// 2. Create and remove a loader through the real strip allocator, asserting its parent and unchanged project-directory timestamp.
// 3. Check ancestor TEMP uses identities, while independent same-volume TEMP and a blocked store keep prior locations.
//
// @evidence contracts/testing.md#behavioral-verification The strip allocator actually creates temporary directories in preexisting identities for cross-volume and ancestor TEMP, and their removal leaves the project directory timestamp and identity child population unchanged; independent same-volume and blocked-store calls keep established locations.
// @evidence contracts/testing.md#independent-expectations The authored identity and legacy cache directories are separate siblings, so their paths and the project's stat before creation give expectations independently of the allocator's result.
// @evidence contracts/testing.md#distinguishing-cases Available identity storage covers cross-volume and ancestor TEMP; independent same-volume TEMP and blocked identity storage preserve default and legacy fallback behavior.
// @evidence contracts/testing.md#execution-ownership The named Go unit calls the strip driver's actual allocator through its existing test bridge and native filesystem calls; it starts no ttsx child or plugin build.
func TestConfigLoaderIdentityScratchPreservesProjectRoot(t *testing.T) {
  root := t.TempDir()
  project := filepath.Join(root, "project")
  legacy := filepath.Join(project, "node_modules", ".cache")
  recordRoot := filepath.Join(root, "cache")
  identity := filepath.Join(recordRoot, "identities")
  for _, dir := range []string{legacy, identity} {
    if err := os.MkdirAll(dir, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  config := filepath.Join(project, "strip.config.ts")
  otherTemp := `Z:\ttsc-test-temp`
  if strings.EqualFold(filepath.VolumeName(root), "Z:") {
    otherTemp = `Y:\ttsc-test-temp`
  }
  physicalIdentity, err := filepath.EvalSymlinks(identity)
  if err != nil {
    t.Fatal(err)
  }
  before, err := os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  created, err := stripCreateConfigLoaderTempDir(config, otherTemp, recordRoot)
  if err != nil {
    t.Fatal(err)
  }
  t.Cleanup(func() {
    if err := os.RemoveAll(created); err != nil {
      t.Errorf("remove identity scratch: %v", err)
    }
  })
  if filepath.Dir(created) != physicalIdentity {
    t.Fatalf("loader parent mismatch: %q != %q", filepath.Dir(created), physicalIdentity)
  }
  if err := os.RemoveAll(created); err != nil {
    t.Fatal(err)
  }
  after, err := os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  if !before.ModTime().Equal(after.ModTime()) {
    t.Fatalf("project directory timestamp changed: %v -> %v", before.ModTime(), after.ModTime())
  }
  entries, err := os.ReadDir(identity)
  if err != nil || len(entries) != 0 {
    t.Fatalf("identity scratch remains: %v, %v", entries, err)
  }
  before, err = os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  ancestor, err := stripCreateConfigLoaderTempDir(config, project, recordRoot)
  if err != nil {
    t.Fatal(err)
  }
  if filepath.Dir(ancestor) != physicalIdentity {
    t.Fatalf("ancestor TEMP did not use identities: %q", ancestor)
  }
  if err := os.RemoveAll(ancestor); err != nil {
    t.Fatal(err)
  }
  after, err = os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  if !before.ModTime().Equal(after.ModTime()) {
    t.Fatalf("ancestor TEMP moved project directory timestamp: %v -> %v", before.ModTime(), after.ModTime())
  }
  separateTemp := filepath.Join(root, "separate-temp")
  if err := os.Mkdir(separateTemp, 0o755); err != nil {
    t.Fatal(err)
  }
  sameVolume, err := stripCreateConfigLoaderTempDir(config, separateTemp, recordRoot)
  if err != nil {
    t.Fatal(err)
  }
  t.Cleanup(func() {
    if err := os.RemoveAll(sameVolume); err != nil {
      t.Errorf("remove system TEMP scratch: %v", err)
    }
  })
  if !strings.EqualFold(filepath.Dir(sameVolume), os.TempDir()) {
    t.Fatalf("independent same-volume TEMP changed default placement: %q", sameVolume)
  }
  blockedRoot := filepath.Join(root, "blocked-cache")
  if err := os.Mkdir(blockedRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(blockedRoot, "identities"), nil, 0o644); err != nil {
    t.Fatal(err)
  }
  fallback, err := stripCreateConfigLoaderTempDir(config, otherTemp, blockedRoot)
  if err != nil {
    t.Fatal(err)
  }
  t.Cleanup(func() {
    if err := os.RemoveAll(fallback); err != nil {
      t.Errorf("remove legacy cache scratch: %v", err)
    }
  })
  physicalLegacy, err := filepath.EvalSymlinks(legacy)
  if err != nil {
    t.Fatal(err)
  }
  if filepath.Dir(fallback) != physicalLegacy {
    t.Fatalf("blocked store did not use legacy cache: %q != %q", filepath.Dir(fallback), physicalLegacy)
  }
}
