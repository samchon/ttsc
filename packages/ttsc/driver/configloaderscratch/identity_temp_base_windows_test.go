package configloaderscratch

import (
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
)

// TestIdentityTempBaseUsesOnlyAnExistingOrdinaryChild verifies the shared
// loader selector accepts an owned sibling directory and same-drive junction
// ancestors while rejecting linked children, missing stores, and ancestors.
//
// 1. Create an ordinary project and record-store sibling, then select its preexisting identities child.
// 2. Accept same-drive cache/config junctions and ancestor TEMP, but preserve independent same-drive TEMP.
// 3. Accept lexical-volume identities for a cross-drive config junction and reject a physical-volume store.
// 4. Create and remove a scratch child under the selected base and check the project directory stays fixed.
//
// @evidence contracts/testing.md#behavioral-verification Calls the shared selector on real Windows directories and junctions, then performs temporary creation and removal at its selected base; unsupported layouts return no preferred base and the project directory's timestamp stays unchanged.
// @evidence contracts/testing.md#independent-expectations The authored sibling, missing child, linked child, same-drive junction and ancestor layouts define valid and invalid paths before the selector runs; the project stat and empty identities listing independently detect root churn and scratch residue.
// @evidence contracts/testing.md#distinguishing-cases Same-drive cache/config junctions and ancestor TEMP contrast with a cross-drive config junction, independent same-volume TEMP, missing and linked identities, and a config inside identities; callers separately test legacy fallback creation.
// @evidence contracts/testing.md#execution-ownership This named Go unit calls the shared filesystem selector directly; cmd only creates junction fixtures, and no compiler, config evaluator, or native plugin runs.
func TestIdentityTempBaseUsesOnlyAnExistingOrdinaryChild(t *testing.T) {
  root := t.TempDir()
  project := filepath.Join(root, "project")
  recordRoot := filepath.Join(root, "cache")
  identity := filepath.Join(recordRoot, "identities")
  for _, dir := range []string{project, identity} {
    if err := os.MkdirAll(dir, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  config := filepath.Join(project, "banner.config.ts")
  otherTemp := `Z:\ttsc-test-temp`
  if strings.EqualFold(filepath.VolumeName(root), "Z:") {
    otherTemp = `Y:\ttsc-test-temp`
  }
  physicalIdentity, err := filepath.EvalSymlinks(identity)
  if err != nil {
    t.Fatal(err)
  }
  if got := IdentityTempBase(config, otherTemp, recordRoot); got != physicalIdentity {
    t.Fatalf("identity base mismatch: %q != %q", got, physicalIdentity)
  }
  separateTemp := filepath.Join(root, "separate-temp")
  if err := os.Mkdir(separateTemp, 0o755); err != nil {
    t.Fatal(err)
  }
  if got := IdentityTempBase(config, separateTemp, recordRoot); got != "" {
    t.Fatalf("independent same-volume TEMP selected identities: %q", got)
  }
  for _, ancestorTemp := range []string{project, root} {
    if got := IdentityTempBase(config, ancestorTemp, recordRoot); got != physicalIdentity {
      t.Fatalf("ancestor TEMP did not select identities: %q", got)
    }
  }
  if got := IdentityTempBase(config, otherTemp, filepath.Join(root, "missing")); got != "" {
    t.Fatalf("missing store selected identities: %q", got)
  }
  before, err := os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  scratch, err := os.MkdirTemp(physicalIdentity, "ttsc-config-loader-")
  if err != nil {
    t.Fatal(err)
  }
  t.Cleanup(func() {
    if err := os.RemoveAll(scratch); err != nil {
      t.Errorf("remove identity scratch: %v", err)
    }
  })
  if err := os.RemoveAll(scratch); err != nil {
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
  linkedRoot := filepath.Join(root, "linked-cache")
  if out, err := exec.Command("cmd", "/c", "mklink", "/J", linkedRoot, recordRoot).CombinedOutput(); err != nil {
    t.Fatalf("cache-root junction failed: %v: %s", err, out)
  }
  if got := IdentityTempBase(config, otherTemp, linkedRoot); got != physicalIdentity {
    t.Fatalf("same-drive linked root did not select canonical identities: %q", got)
  }
  linkedProject := filepath.Join(root, "linked-project")
  if out, err := exec.Command("cmd", "/c", "mklink", "/J", linkedProject, project).CombinedOutput(); err != nil {
    t.Fatalf("project junction failed: %v: %s", err, out)
  }
  if got := IdentityTempBase(filepath.Join(linkedProject, "banner.config.ts"), otherTemp, recordRoot); got != physicalIdentity {
    t.Fatalf("same-drive linked config did not select canonical identities: %q", got)
  }
  linkedTemp := filepath.Join(root, "linked-temp")
  if out, err := exec.Command("cmd", "/c", "mklink", "/J", linkedTemp, project).CombinedOutput(); err != nil {
    t.Fatalf("TEMP junction failed: %v: %s", err, out)
  }
  if got := IdentityTempBase(config, linkedTemp, recordRoot); got != physicalIdentity {
    t.Fatalf("physical ancestor TEMP did not select identities: %q", got)
  }
  linkedIdentityRoot := filepath.Join(root, "linked-identity-cache")
  if err := os.Mkdir(linkedIdentityRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  if out, err := exec.Command("cmd", "/c", "mklink", "/J", filepath.Join(linkedIdentityRoot, "identities"), identity).CombinedOutput(); err != nil {
    t.Fatalf("identity junction failed: %v: %s", err, out)
  }
  if got := IdentityTempBase(config, otherTemp, linkedIdentityRoot); got != "" {
    t.Fatalf("linked identities selected: %q", got)
  }
  nested := filepath.Join(identity, "nested")
  if err := os.Mkdir(nested, 0o755); err != nil {
    t.Fatal(err)
  }
  if got := IdentityTempBase(filepath.Join(nested, "banner.config.ts"), otherTemp, recordRoot); got != "" {
    t.Fatalf("config inside identities selected ancestor: %q", got)
  }
  checkout, err := os.Getwd()
  if err != nil {
    t.Fatal(err)
  }
  if !strings.EqualFold(filepath.VolumeName(checkout), filepath.VolumeName(root)) {
    packageRoot := filepath.Clean(filepath.Join(checkout, "..", ".."))
    otherPhysical, err := os.MkdirTemp(packageRoot, "ttsc-banner-junction-test-")
    if err != nil {
      t.Fatal(err)
    }
    t.Cleanup(func() {
      if err := os.RemoveAll(otherPhysical); err != nil {
        t.Errorf("remove cross-volume fixture: %v", err)
      }
    })
    if err := os.Mkdir(filepath.Join(otherPhysical, "identities"), 0o755); err != nil {
      t.Fatal(err)
    }
    configAlias := filepath.Join(root, "linked-other-volume-config")
    if out, err := exec.Command("cmd", "/c", "mklink", "/J", configAlias, otherPhysical).CombinedOutput(); err != nil {
      t.Fatalf("cross-volume config junction failed: %v: %s", err, out)
    }
    linkedConfig := filepath.Join(configAlias, "banner.config.ts")
    if got := IdentityTempBase(linkedConfig, otherTemp, recordRoot); got != physicalIdentity {
      t.Fatalf("lexical-volume identities not selected for linked config: %q", got)
    }
    if got := IdentityTempBase(linkedConfig, otherTemp, otherPhysical); got != "" {
      t.Fatalf("physical-volume identities selected for linked config: %q", got)
    }
  }
}
