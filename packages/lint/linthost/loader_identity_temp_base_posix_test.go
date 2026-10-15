//go:build !windows

package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestLoaderIdentityTempBaseKeepsPOSIXConfigRootStable verifies an existing
// record store receives lint-loader scratch when TMPDIR is the config root.
//
// 1. Create an ordinary project and a separate record store with identities.
// 2. Select identities for project-root TMPDIR and create/remove scratch without changing the project directory.
// 3. Preserve independent TMPDIR and relative-config fallback, and reject linked or ancestor identities.
//
// @evidence contracts/testing.md#behavioral-verification The lint selector returns the existing identity directory for project-root TMPDIR, where actual temporary creation and removal leave project metadata and identity contents stable; unsupported layouts return no preference.
// @evidence contracts/testing.md#independent-expectations Authored sibling directories and before/after project metadata establish safe placement without using the selector as the oracle; an empty identities listing detects leaked scratch.
// @evidence contracts/testing.md#distinguishing-cases Project-root, symlinked, and available case-only project-root TMPDIR select identities, while independent TMPDIR, relative config, missing or linked identity, and an identity ancestor of config preserve fallback.
// @evidence contracts/testing.md#execution-ownership This named Go unit calls the lint selector and native filesystem operations in-process without launching ttsx or a plugin host.
func TestLoaderIdentityTempBaseKeepsPOSIXConfigRootStable(t *testing.T) {
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
  want, err := filepath.EvalSymlinks(identity)
  if err != nil {
    t.Fatal(err)
  }
  if got := loaderIdentityTempBase(config, project, recordRoot); got != want {
    t.Fatalf("project-root TMPDIR selected %q, want %q", got, want)
  }
  before, err := os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  scratch, err := os.MkdirTemp(want, "ttsc-lint-config-")
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
  if got := loaderIdentityTempBase(config, separateTemp, recordRoot); got != "" {
    t.Fatalf("independent TMPDIR selected identities: %q", got)
  }
  if got := loaderIdentityTempBase("lint.config.ts", project, recordRoot); got != "" {
    t.Fatalf("relative config selected identities: %q", got)
  }
  linkedTemp := filepath.Join(root, "linked-temp")
  if err := os.Symlink(project, linkedTemp); err != nil {
    t.Fatal(err)
  }
  if got := loaderIdentityTempBase(config, linkedTemp, recordRoot); got != want {
    t.Fatalf("linked project-root TMPDIR selected %q, want %q", got, want)
  }
  missingRoot := filepath.Join(root, "missing-cache")
  if got := loaderIdentityTempBase(config, project, missingRoot); got != "" {
    t.Fatalf("missing store selected identities: %q", got)
  }
  linkedIdentityRoot := filepath.Join(root, "linked-identity-cache")
  if err := os.Mkdir(linkedIdentityRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Symlink(identity, filepath.Join(linkedIdentityRoot, "identities")); err != nil {
    t.Fatal(err)
  }
  if got := loaderIdentityTempBase(config, project, linkedIdentityRoot); got != "" {
    t.Fatalf("linked identity child selected: %q", got)
  }
  nested := filepath.Join(identity, "nested")
  if err := os.Mkdir(nested, 0o755); err != nil {
    t.Fatal(err)
  }
  if got := loaderIdentityTempBase(filepath.Join(nested, "lint.config.ts"), project, recordRoot); got != "" {
    t.Fatalf("identity ancestor of config selected: %q", got)
  }
  alternateCase := strings.ToUpper(project)
  projectInfo, projectErr := os.Stat(project)
  aliasInfo, aliasErr := os.Stat(alternateCase)
  if projectErr == nil && aliasErr == nil && os.SameFile(projectInfo, aliasInfo) {
    if got := loaderIdentityTempBase(config, alternateCase, recordRoot); got != want {
      t.Fatalf("case-only ancestor TMPDIR selected %q, want %q", got, want)
    }
    if got := loaderIdentityTempBase(filepath.Join(strings.ToUpper(identity), "nested", "lint.config.ts"), project, recordRoot); got != "" {
      t.Fatalf("case-only identity ancestor selected: %q", got)
    }
  }
}
