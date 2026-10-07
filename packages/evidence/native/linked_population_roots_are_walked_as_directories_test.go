package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// writeLinkedDocuments builds a real directory and a link that names it, or
// fails when the platform refuses to create either.
//
// The shared linkDirectory helper creates a symbolic link on POSIX and a directory junction on Windows.
func writeLinkedDocuments(t *testing.T, workspace string, files map[string]string) {
  t.Helper()
  target := filepath.Join(workspace, "target")
  for relative, content := range files {
    absolute := filepath.Join(target, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  if err := linkDirectory(t, target, filepath.Join(workspace, "documents")); err != nil {
    t.Fatalf("this platform refused to create a link: %v", err)
  }
}

// logLinkedPopulationPaths reports host and bounded resolver results when a
// population unexpectedly deactivates, without supplying an expected output.
func logLinkedPopulationPaths(t *testing.T, root string) {
  t.Helper()
  canonical := canonicalTypeScriptDirectory(root)
  paths := &typeScriptSourcePaths{directories: map[string]string{filepath.Clean(root): canonical}, files: map[string]string{}}
  for _, relative := range []string{".", "src", "src/sale.ts", "src/spec.ts"} {
    name := filepath.Join(root, filepath.FromSlash(relative))
    info, statErr := os.Stat(name)
    directory := info != nil && info.IsDir()
    bounded, settled := resolveLinkedPath(name)
    evaluated, evalErr := filepath.EvalSymlinks(name)
    resolved := paths.resolve(name)
    matched, within := relativeProjectPath(canonical, resolved)
    t.Logf("path=%q stat=%v directory=%v bounded=%q settled=%v host=%q hostError=%v canonicalDirectory=%q source=%q base=%q relative=%q within=%v", name, statErr, directory, bounded, settled, evaluated, evalErr, canonicalTypeScriptDirectory(filepath.Dir(name)), resolved, canonical, matched, within)
  }
}
