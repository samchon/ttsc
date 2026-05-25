package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPExecuteCommandMaterializesSymlinkTargetWithoutMutatingOriginal verifies
// symlinked command targets stay non-mutating.
//
// The LSP cascade runs in a temporary workspace. If that workspace preserves
// symlinks, writes in the temp tree can follow the link back to the user's real
// source file and violate the WorkspaceEdit contract.
//
// 1. Seed a project whose included source file is a symlink to another file.
// 2. Execute `ttsc.lint.fixAll` for the symlink URI.
// 3. Assert the returned WorkspaceEdit fixes the visible document.
// 4. Assert neither the symlink target nor the symlink path content changed.
func TestLSPExecuteCommandMaterializesSymlinkTargetWithoutMutatingOriginal(t *testing.T) {
  root := t.TempDir()
  source := "var legacy = 1;\nJSON.stringify(legacy);\n"
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src/main.ts"]
}
`)
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  realFile := filepath.Join(root, "real", "main.ts")
  writeFile(t, realFile, source)
  if err := os.MkdirAll(filepath.Join(root, "src"), 0o755); err != nil {
    t.Fatal(err)
  }
  linkFile := filepath.Join(root, "src", "main.ts")
  if err := os.Symlink(realFile, linkFile); err != nil {
    t.Skipf("symlink unavailable: %v", err)
  }

  uri := lintTestFileURI(t, linkFile)
  got := executeLSPCommandAppliedTextForTest(t, root, uri, commandLintFixAll, source)
  if got != "let legacy = 1;\nJSON.stringify(legacy);\n" {
    t.Fatalf("symlink LSP fix text mismatch: %q", got)
  }
  assertFileText(t, realFile, source)
  assertFileText(t, linkFile, source)
}
