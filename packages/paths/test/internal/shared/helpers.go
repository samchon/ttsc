package shared

import (
  "os"
  "path/filepath"
  "testing"
)

// SeedProject creates a project-shaped fixture tree for command-frontdoor
// tests. The sidecar is intentionally tested through real files and tsconfig.
func SeedProject(t *testing.T, files map[string]string) string {
  t.Helper()
  root := t.TempDir()
  for name, text := range files {
    file := filepath.Join(root, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  return root
}
