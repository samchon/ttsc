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

  for label, location := range map[string]string{
    "exact declaration": exact,
    "glob member":       matched,
  } {
    owners := source.ProjectInputOwnersForURI(testFileURI(location))
    if len(owners) != 1 || owners[0] != pluginKey(plugin) {
      t.Fatalf("%s owners = %#v", label, owners)
    }
  }
}
