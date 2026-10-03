package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

func prismaDigestRoot(t *testing.T, files map[string]string) string {
  t.Helper()
  root := t.TempDir()
  for relative, content := range files {
    absolute := filepath.Join(root, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  return root
}
