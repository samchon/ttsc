package main

import (
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRunExternalESLintFixesReportsFixedCount verifies runtime fix plumbing.
//
// The fix command delegates ESLint-backed configs to the installed ESLint API.
// The Go side only owns file-list encoding, missing-runtime handling, and the
// fixed-count result that decides whether the Program must be reloaded.
//
// 1. Create a fake Node executable that returns an ESLint fix payload.
// 2. Run the external ESLint fix bridge for one source file.
// 3. Assert the bridge reports the fixed file count.
func TestRunExternalESLintFixesReportsFixedCount(t *testing.T) {
  root := t.TempDir()
  config := filepath.Join(root, "eslint.config.js")
  writeFile(t, config, "export default [];")
  fakeNode := filepath.Join(root, "fake-node")
  writeFile(t, fakeNode, "#!/bin/sh\nprintf '{\"missing\":false,\"fixed\":2,\"results\":[]}'\n")
  if err := os.Chmod(fakeNode, 0o755); err != nil {
    t.Fatalf("chmod fake node: %v", err)
  }
  t.Setenv("TTSC_NODE_BINARY", fakeNode)

  store := &ConfigStore{externalConfigPath: config, eslintRuntime: true}
  file := parseTSFile(t, filepath.Join(root, "src", "main.ts"), "var value = 1;\n")
  fixed, err := runExternalESLintFixes(store, root, []*shimast.SourceFile{file})
  if err != nil {
    t.Fatalf("runExternalESLintFixes: %v", err)
  }
  if fixed != 2 {
    t.Fatalf("fix bridge mismatch: fixed=%d", fixed)
  }
}
