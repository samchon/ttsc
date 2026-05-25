package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPExecuteCommandMaterializesDuplicateSymlinkedDirectories verifies
// distinct aliases to one real directory are copied independently.
//
// Symlink-cycle protection must be scoped to the active recursion branch. If it
// globally dedupes by real path, a project with `src-a -> real-src` and
// `src-b -> real-src` can omit the second visible path from the temp workspace.
//
// 1. Seed two symlinked source directories that target the same real directory.
// 2. Include the second alias in tsconfig.
// 3. Execute `ttsc.lint.fixAll` for the second alias.
// 4. Assert the edit is returned and the backing source is unchanged.
func TestLSPExecuteCommandMaterializesDuplicateSymlinkedDirectories(t *testing.T) {
  root := t.TempDir()
  source := "var legacy = 1;\nJSON.stringify(legacy);\n"
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src-b/main.ts"]
}
`)
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  realDir := filepath.Join(root, "real-src")
  realFile := filepath.Join(realDir, "main.ts")
  writeFile(t, realFile, source)
  if err := os.Symlink(realDir, filepath.Join(root, "src-a")); err != nil {
    t.Skipf("symlink unavailable: %v", err)
  }
  if err := os.Symlink(realDir, filepath.Join(root, "src-b")); err != nil {
    t.Skipf("second symlink unavailable: %v", err)
  }
  linkFile := filepath.Join(root, "src-b", "main.ts")
  uri := lintTestFileURI(t, linkFile)

  got := executeLSPCommandAppliedTextForTest(t, root, uri, commandLintFixAll, source)
  want := "let legacy = 1;\nJSON.stringify(legacy);\n"
  if got != want {
    t.Fatalf("duplicate symlink dir LSP fix text mismatch:\nwant %q\ngot  %q", want, got)
  }
  assertFileText(t, realFile, source)
  assertFileText(t, linkFile, source)
}
