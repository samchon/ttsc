package lspserver

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPProjectInputOwnershipResolvesDeclaredSpellings verifies a declaration
// is matched against an event through one filesystem identity.
//
// The candidate always arrives from an editor URI and is resolved physically,
// so comparing it against a declaration that was only cleaned lexically can
// never match wherever the two spellings differ. A Windows short (8.3)
// component, which the system temporary directory routinely carries, and a
// symlinked ancestor such as macOS `/var` both produce exactly that, and the
// contributor that declared the file then receives no refresh at all.
//
//  1. Declare an exact file and a glob through a directory alias.
//  2. Ask for the owners of the same paths spelled physically.
//  3. Assert the declaring producer owns both.
//  4. Assert two adjacent paths one property away are owned by nobody.
func TestLSPProjectInputOwnershipResolvesDeclaredSpellings(t *testing.T) {
  physical := t.TempDir()
  alias := filepath.Join(t.TempDir(), "project")
  if err := os.Symlink(physical, alias); err != nil {
    t.Skipf("filesystem cannot express a directory alias: %v", err)
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
    if len(owners) != 1 || owners[0] != pluginKey(plugin) {
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
