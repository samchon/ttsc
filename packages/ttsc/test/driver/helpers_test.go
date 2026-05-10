package ttsc_test

import (
	"os"
	"path/filepath"
	"testing"
)

// writeProjectFile materializes one project-shaped fixture file. The tests in
// this package intentionally build real tsconfig projects instead of mocking
// compiler internals, so each scenario owns its whole temporary project tree.
func writeProjectFile(t *testing.T, root, name, contents string) {
	t.Helper()
	file := filepath.Join(root, filepath.FromSlash(name))
	if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file, []byte(contents), 0o644); err != nil {
		t.Fatal(err)
	}
}
