//go:build windows

package linthost

import (
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
)

// TestWindowsLoaderIdentityTempBasePreservesConfigDirectory verifies a native
// config loader can use an already-open record store without moving the config
// directory's metadata during temporary loader creation and removal.
//
// 1. Choose a different simulated system-temp drive and an existing identity directory.
// 2. Create and remove a loader there, then assert the config directory's timestamp stays fixed.
// 3. Accept project-root and same-drive junction stores and ancestor TEMP, then reject missing, blocked, linked, and config-ancestor identities.
// 4. Accept lexical-volume identities for a cross-drive config junction and reject a physical-volume store.
//
// @evidence contracts/testing.md#behavioral-verification The selected identity directory hosts actual MkdirTemp/RemoveAll work without changing the config directory timestamp or retaining scratch; unsupported stores return no preference and legacy placement remains on the config volume.
// @evidence contracts/testing.md#independent-expectations Windows directory metadata changes when a direct child is created or removed; authored sibling, blocked, missing, junction, ancestor, and same-volume layouts define independent valid and invalid inputs.
// @evidence contracts/testing.md#distinguishing-cases Preexisting sibling, project-root, same-drive junction and ancestor TEMP stores are accepted, while independent same-drive TEMP, absent, blocked or linked identities, a cross-drive cache store, and an identity ancestor of the config are rejected. The established fallback selector remains covered by TestWindowsLoaderTempBaseStaysOnConfigVolume.
// @evidence contracts/testing.md#execution-ownership This Go unit invokes the real filesystem selector and native temporary directory calls in-process; cmd creates only the Windows junction fixture, and no ttsx child or native plugin build runs.
func TestWindowsLoaderIdentityTempBasePreservesConfigDirectory(t *testing.T) {
  root := t.TempDir()
  project := filepath.Join(root, "project")
  recordRoot := filepath.Join(root, "cache")
  identity := filepath.Join(recordRoot, "identities")
  for _, dir := range []string{project, identity} {
    if err := os.MkdirAll(dir, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  config := filepath.Join(project, "lint.config.ts")
  otherVolumeTemp := `Z:\ttsc-fake-temp`
  if strings.EqualFold(filepath.VolumeName(root), "Z:") {
    otherVolumeTemp = `Y:\ttsc-fake-temp`
  }
  want, err := filepath.EvalSymlinks(identity)
  if err != nil {
    t.Fatal(err)
  }
  if got := loaderIdentityTempBase(config, otherVolumeTemp, recordRoot); got != want {
    t.Fatalf("identity scratch base mismatch: %q != %q", got, want)
  }
  before, err := os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  temporary, err := os.MkdirTemp(want, "ttsc-lint-config-")
  if err != nil {
    t.Fatal(err)
  }
  if err := os.RemoveAll(temporary); err != nil {
    t.Fatal(err)
  }
  after, err := os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  if !before.ModTime().Equal(after.ModTime()) {
    t.Fatalf("config directory timestamp moved: %v -> %v", before.ModTime(), after.ModTime())
  }
  entries, err := os.ReadDir(identity)
  if err != nil {
    t.Fatal(err)
  }
  for _, entry := range entries {
    if strings.HasPrefix(entry.Name(), "ttsc-lint-config-") {
      t.Fatalf("identity scratch remains after cleanup: %s", entry.Name())
    }
  }
  projectIdentity := filepath.Join(project, "identities")
  if err := os.Mkdir(projectIdentity, 0o755); err != nil {
    t.Fatal(err)
  }
  projectWant, err := filepath.EvalSymlinks(projectIdentity)
  if err != nil {
    t.Fatal(err)
  }
  if got := loaderIdentityTempBase(config, otherVolumeTemp, project); got != projectWant {
    t.Fatalf("project-root store mismatch: %q != %q", got, projectWant)
  }
  linkedProject := filepath.Join(root, "linked-project")
  if output, err := exec.Command("cmd", "/c", "mklink", "/J", linkedProject, project).CombinedOutput(); err != nil {
    t.Fatalf("same-drive config junction failed: %v: %s", err, output)
  }
  if got := loaderIdentityTempBase(filepath.Join(linkedProject, "lint.config.ts"), otherVolumeTemp, recordRoot); got != want {
    t.Fatalf("same-drive linked config did not select canonical identities: %q", got)
  }
  linkedRecordRoot := filepath.Join(root, "linked-record-root")
  if output, err := exec.Command("cmd", "/c", "mklink", "/J", linkedRecordRoot, recordRoot).CombinedOutput(); err != nil {
    t.Fatalf("same-drive record junction failed: %v: %s", err, output)
  }
  if got := loaderIdentityTempBase(config, otherVolumeTemp, linkedRecordRoot); got != want {
    t.Fatalf("same-drive linked record root did not select canonical identities: %q", got)
  }
  before, err = os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  temporary, err = os.MkdirTemp(projectWant, "ttsc-lint-config-")
  if err != nil {
    t.Fatal(err)
  }
  if err := os.RemoveAll(temporary); err != nil {
    t.Fatal(err)
  }
  after, err = os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  if !before.ModTime().Equal(after.ModTime()) {
    t.Fatalf("project-root store moved config directory timestamp: %v -> %v", before.ModTime(), after.ModTime())
  }
  separateTemp := filepath.Join(root, "separate-temp")
  if err := os.Mkdir(separateTemp, 0o755); err != nil {
    t.Fatal(err)
  }
  if got := loaderIdentityTempBase(config, separateTemp, recordRoot); got != "" {
    t.Fatalf("independent same-volume temp unexpectedly selected cache: %q", got)
  }
  for _, ancestorTemp := range []string{project, root} {
    if got := loaderIdentityTempBase(config, ancestorTemp, recordRoot); got != want {
      t.Fatalf("ancestor TEMP did not select identities: %q", got)
    }
  }
  linkedTemp := filepath.Join(root, "linked-temp")
  if output, err := exec.Command("cmd", "/c", "mklink", "/J", linkedTemp, project).CombinedOutput(); err != nil {
    t.Fatalf("TEMP junction failed: %v: %s", err, output)
  }
  if got := loaderIdentityTempBase(config, linkedTemp, recordRoot); got != want {
    t.Fatalf("physical ancestor TEMP did not select identities: %q", got)
  }
  if got := loaderIdentityTempBase(config, otherVolumeTemp, filepath.Join(root, "missing")); got != "" {
    t.Fatalf("missing store unexpectedly selected cache: %q", got)
  }
  blockedRoot := filepath.Join(root, "blocked-cache")
  if err := os.Mkdir(blockedRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(blockedRoot, "identities"), nil, 0o644); err != nil {
    t.Fatal(err)
  }
  if got := loaderIdentityTempBase(config, otherVolumeTemp, blockedRoot); got != "" {
    t.Fatalf("blocked identity child unexpectedly selected cache: %q", got)
  }
  if fallback := loaderTempBase(config, otherVolumeTemp); fallback == "" ||
    !strings.EqualFold(filepath.VolumeName(fallback), filepath.VolumeName(config)) {
    t.Fatalf("blocked identity fallback left config volume: %q", fallback)
  }
  if err := os.Mkdir(filepath.Join(identity, "nested"), 0o755); err != nil {
    t.Fatal(err)
  }
  if got := loaderIdentityTempBase(filepath.Join(identity, "nested", "lint.config.ts"), otherVolumeTemp, recordRoot); got != "" {
    t.Fatalf("config inside identity cache unexpectedly selected cache: %q", got)
  }

  linkedRoot := filepath.Join(root, "linked-cache")
  realIdentity := filepath.Join(root, "real-identities")
  for _, dir := range []string{linkedRoot, realIdentity} {
    if err := os.MkdirAll(dir, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  junction := filepath.Join(linkedRoot, "identities")
  if output, err := exec.Command("cmd", "/c", "mklink", "/J", junction, realIdentity).CombinedOutput(); err != nil {
    t.Fatalf("mklink /J failed: %v: %s", err, output)
  }
  if got := loaderIdentityTempBase(config, otherVolumeTemp, linkedRoot); got != "" {
    t.Fatalf("linked identities unexpectedly selected cache: %q", got)
  }
  checkout, err := os.Getwd()
  if err != nil {
    t.Fatal(err)
  }
  if !strings.EqualFold(filepath.VolumeName(checkout), filepath.VolumeName(root)) {
    checkoutRoot := filepath.Clean(filepath.Join(checkout, "..", "..", ".."))
    otherPhysical, err := os.MkdirTemp(checkoutRoot, "ttsc-lint-junction-test-")
    if err != nil {
      t.Fatal(err)
    }
    t.Cleanup(func() {
      if err := os.RemoveAll(otherPhysical); err != nil {
        t.Errorf("remove cross-volume fixture: %v", err)
      }
    })
    alias := filepath.Join(root, "linked-cache-root")
    if err := os.Mkdir(filepath.Join(otherPhysical, "identities"), 0o755); err != nil {
      t.Fatal(err)
    }
    if output, err := exec.Command("cmd", "/c", "mklink", "/J", alias, otherPhysical).CombinedOutput(); err != nil {
      t.Fatalf("cross-volume mklink /J failed: %v: %s", err, output)
    }
    if got := loaderIdentityTempBase(config, otherVolumeTemp, alias); got != "" {
      t.Fatalf("cross-volume cache junction unexpectedly selected: %q", got)
    }
    linkedConfigRoot := filepath.Join(root, "linked-cross-volume-config")
    if output, err := exec.Command("cmd", "/c", "mklink", "/J", linkedConfigRoot, otherPhysical).CombinedOutput(); err != nil {
      t.Fatalf("cross-volume config junction failed: %v: %s", err, output)
    }
    linkedConfig := filepath.Join(linkedConfigRoot, "lint.config.ts")
    if got := loaderIdentityTempBase(linkedConfig, otherVolumeTemp, recordRoot); got != want {
      t.Fatalf("lexical-volume identities not selected for linked config: %q", got)
    }
    if got := loaderIdentityTempBase(linkedConfig, otherVolumeTemp, otherPhysical); got != "" {
      t.Fatalf("physical-volume identities selected for linked config: %q", got)
    }
  }
}
