//go:build !windows

package configloaderscratch

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestIdentityTempBaseKeepsPOSIXConfigRootStable verifies an existing record
// store receives loader scratch when TMPDIR contains the config directory.
//
// 1. Create a project and a separate record store with an ordinary identities child.
// 2. Select identities for ancestor TMPDIR, then create and remove scratch without changing the project directory.
// 3. Preserve independent TMPDIR and relative-config behavior, and reject linked or ancestor identities.
//
// @evidence contracts/testing.md#behavioral-verification The selector returns an existing identities child for ancestor TMPDIR, and actual MkdirTemp/RemoveAll there leaves the project timestamp and cache contents unchanged; unsupported layouts return no preference.
// @evidence contracts/testing.md#independent-expectations The authored sibling directories, before/after project stat, and empty identity listing independently establish placement and cleanup instead of deriving them from the selector.
// @evidence contracts/testing.md#distinguishing-cases Ancestor, symlinked ancestor, and available case-only ancestor TMPDIR select identities; independent TMPDIR, relative config, missing or linked identity, and an identity ancestor of the config keep the existing fallback.
// @evidence contracts/testing.md#execution-ownership This named Go unit exercises the portable selector and filesystem directly without launching a compiler, config evaluator, or native plugin.
func TestIdentityTempBaseKeepsPOSIXConfigRootStable(t *testing.T) {
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
  want, err := filepath.EvalSymlinks(identity)
  if err != nil {
    t.Fatal(err)
  }
  if got := IdentityTempBase(config, project, recordRoot); got != want {
    t.Fatalf("ancestor TMPDIR selected %q, want %q", got, want)
  }
  before, err := os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  scratch, err := os.MkdirTemp(want, "ttsc-banner-config-")
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
  separateTemp := filepath.Join(root, "separate-temp")
  if err := os.Mkdir(separateTemp, 0o755); err != nil {
    t.Fatal(err)
  }
  if got := IdentityTempBase(config, separateTemp, recordRoot); got != "" {
    t.Fatalf("independent TMPDIR selected identities: %q", got)
  }
  if got := IdentityTempBase("banner.config.ts", project, recordRoot); got != "" {
    t.Fatalf("relative config selected identities: %q", got)
  }
  linkedTemp := filepath.Join(root, "linked-temp")
  if err := os.Symlink(project, linkedTemp); err != nil {
    t.Fatal(err)
  }
  if got := IdentityTempBase(config, linkedTemp, recordRoot); got != want {
    t.Fatalf("linked ancestor TMPDIR selected %q, want %q", got, want)
  }
  linkedRoot := filepath.Join(root, "linked-cache")
  if err := os.Symlink(recordRoot, linkedRoot); err != nil {
    t.Fatal(err)
  }
  if got := IdentityTempBase(config, project, linkedRoot); got != want {
    t.Fatalf("linked store root selected %q, want %q", got, want)
  }
  missingRoot := filepath.Join(root, "missing-cache")
  if got := IdentityTempBase(config, project, missingRoot); got != "" {
    t.Fatalf("missing store selected identities: %q", got)
  }
  linkedIdentityRoot := filepath.Join(root, "linked-identity-cache")
  if err := os.Mkdir(linkedIdentityRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Symlink(identity, filepath.Join(linkedIdentityRoot, "identities")); err != nil {
    t.Fatal(err)
  }
  if got := IdentityTempBase(config, project, linkedIdentityRoot); got != "" {
    t.Fatalf("linked identity child selected: %q", got)
  }
  nested := filepath.Join(identity, "nested")
  if err := os.Mkdir(nested, 0o755); err != nil {
    t.Fatal(err)
  }
  if got := IdentityTempBase(filepath.Join(nested, "banner.config.ts"), project, recordRoot); got != "" {
    t.Fatalf("identity ancestor of config selected: %q", got)
  }
  alternateCase := strings.ToUpper(project)
  projectInfo, projectErr := os.Stat(project)
  aliasInfo, aliasErr := os.Stat(alternateCase)
  if projectErr == nil && aliasErr == nil && os.SameFile(projectInfo, aliasInfo) {
    if got := IdentityTempBase(config, alternateCase, recordRoot); got != want {
      t.Fatalf("case-only ancestor TMPDIR selected %q, want %q", got, want)
    }
    if got := IdentityTempBase(filepath.Join(strings.ToUpper(identity), "nested", "banner.config.ts"), project, recordRoot); got != "" {
      t.Fatalf("case-only identity ancestor selected: %q", got)
    }
  }
}
