package lspserver

import (
  "errors"
  "os"
  "path/filepath"
  "runtime"
  "syscall"
  "testing"
)

// TestLSPProjectInputOwnershipResolvesDeclaredSpellings verifies a declaration
// is matched against an event through one filesystem identity.
//
// An owned directory symlink supplies a spelling distinct from the physical
// candidate URI. Exact-file and glob ownership must bridge that alias without
// accepting two adjacent unowned paths. This does not exercise Windows short
// names, a system macOS alias or an actual contributor refresh.
//
//  1. Declare an exact file and a glob through a directory alias.
//  2. Ask for the owners of the same paths spelled physically.
//  3. Assert the declaring producer owns both.
//  4. Assert two adjacent paths one property away are owned by nobody.
//
// @evidence contracts/testing.md#behavioral-verification An exact file and a glob declared through a directory alias are owned by the declaring producer when the same paths are spelled physically, and adjacent paths one property away are owned by nobody.
// @evidence contracts/testing.md#independent-expectations A single literal producer key is required for each positive and zero owners for each negative, independently of pluginKey. The fixture creates the actual alias and files; expected membership does not come from the matcher.
// @evidence contracts/testing.md#distinguishing-cases Alias and physical spellings must match while near-miss paths must not.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit directly stores a snapshot and calls NativePluginSource.ProjectInputOwnersForURI over owned native temporary files and a real directory symlink. Only Windows privilege-not-held skips this alias case; other creation errors fail. No native sidecar starts and no consumer or product host is installed, though Windows identity uses native directory queries.
func TestLSPProjectInputOwnershipResolvesDeclaredSpellings(t *testing.T) {
  physical := t.TempDir()
  alias := filepath.Join(t.TempDir(), "project")
  if err := os.Symlink(physical, alias); err != nil {
    if runtime.GOOS == "windows" && errors.Is(err, syscall.Errno(1314)) {
      t.Skipf("Windows symlink privilege is unavailable: %v", err)
    }
    t.Fatalf("create owned directory alias: %v", err)
  }
  for _, directory := range []string{
    filepath.Join(physical, "docs"),
    filepath.Join(physical, "api"),
  } {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  exact := filepath.Join(physical, "docs", "spec.md")
  matched := filepath.Join(physical, "api", "openapi.json")
  for _, location := range []string{exact, matched} {
    if err := os.WriteFile(location, []byte("{}\n"), 0o644); err != nil {
      t.Fatal(err)
    }
  }

  plugin := NativeLSPPluginEntry{
    Binary:             "ttsc-no-such-alias-sidecar",
    Name:               "@ttsc/alias",
    ProjectDiagnostics: true,
    ProjectInputs:      true,
  }
  source := &NativePluginSource{plugins: []NativeLSPPluginEntry{plugin}}
  source.storeProjectInputs(plugin, 1, LSPProjectInputSnapshot{
    Root:  filepath.ToSlash(alias),
    Files: []string{filepath.ToSlash(filepath.Join(alias, "docs", "spec.md"))},
    Globs: []string{
      filepath.ToSlash(filepath.Join(alias, "api", "**", "*.json")),
    },
  })

  for _, owned := range []struct {
    label    string
    location string
  }{
    {label: "exact declaration", location: exact},
    {label: "glob member", location: matched},
  } {
    owners := source.ProjectInputOwnersForURI(testFileURI(owned.location))
    if len(owners) != 1 || owners[0] != "ttsc-no-such-alias-sidecar\x000" {
      t.Fatalf("%s owners = %#v", owned.label, owners)
    }
  }

  // Resolving both sides collapses distinct spellings onto one physical path,
  // so over-matching is the failure this lane can produce. Each negative sits
  // one property away from an owned path: the same directory with another
  // extension, and the same extension outside every declaration.
  for _, unowned := range []struct {
    label    string
    location string
  }{
    {
      label:    "a sibling the glob does not select",
      location: filepath.Join(physical, "api", "openapi.txt"),
    },
    {
      label:    "a path outside every declaration",
      location: filepath.Join(physical, "docs", "other.json"),
    },
  } {
    owners := source.ProjectInputOwnersForURI(testFileURI(unowned.location))
    if len(owners) != 0 {
      t.Fatalf("%s owners = %#v", unowned.label, owners)
    }
  }
}
