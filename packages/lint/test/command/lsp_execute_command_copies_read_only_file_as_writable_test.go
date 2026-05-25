package linthost

import (
  "os"
  "path/filepath"
  "runtime"
  "testing"
)

// TestLSPExecuteCommandCopiesReadOnlyFileAsWritable verifies read-only sources
// can still produce WorkspaceEdits.
//
// The LSP command path writes only inside a temp workspace. If that temp copy
// preserves a source file's read-only mode exactly, the cascade can fail before
// it computes the edit even though the real file should never be mutated.
//
// 1. Seed a project with a read-only source file.
// 2. Execute `ttsc.lint.fixAll` through the LSP command path.
// 3. Assert the returned WorkspaceEdit fixes the document.
// 4. Assert the original read-only file remains unchanged.
func TestLSPExecuteCommandCopiesReadOnlyFileAsWritable(t *testing.T) {
  if runtime.GOOS == "windows" {
    t.Skip("chmod read-only semantics differ on Windows")
  }
  source := "var legacy = 1;\nJSON.stringify(legacy);\n"
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  file := filepath.Join(root, "src", "main.ts")
  if err := os.Chmod(file, 0o444); err != nil {
    t.Fatal(err)
  }
  t.Cleanup(func() { _ = os.Chmod(file, 0o644) })
  uri := lintTestFileURI(t, file)

  got := executeLSPCommandAppliedTextForTest(t, root, uri, commandLintFixAll, source)
  want := "let legacy = 1;\nJSON.stringify(legacy);\n"
  if got != want {
    t.Fatalf("read-only LSP fix text mismatch:\nwant %q\ngot  %q", want, got)
  }
  assertFileText(t, file, source)
}
