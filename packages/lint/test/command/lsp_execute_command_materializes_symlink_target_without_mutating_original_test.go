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
// @evidence contracts/testing.md#behavioral-verification Fix-all returns the authored edit for an included file symlink URI without changing either target or visible-link source content.
// @evidence contracts/testing.md#independent-expectations The literal source rewrite and original fixture bytes establish expectations independently of link-copy decisions or WorkspaceEdit generation.
// @evidence contracts/testing.md#distinguishing-cases The included src/main.ts is a file symlink to real/main.ts, so a staging copy that preserved the link would write through to the target; the literal let rewrite must be returned and both the link path and the target must still read the original var text. The test skips where symlinks cannot be created.
// @evidence contracts/testing.md#execution-ownership TestLSPExecuteCommandMaterializesSymlinkTargetWithoutMutatingOriginal owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
func TestLSPExecuteCommandMaterializesSymlinkTargetWithoutMutatingOriginal(t *testing.T) {
  root := t.TempDir()
  source := "var legacy = 1;\nJSON.stringify(legacy);\nexport {};\n"
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
  if got != "let legacy = 1;\nJSON.stringify(legacy);\nexport {};\n" {
    t.Fatalf("symlink LSP fix text mismatch: %q", got)
  }
  assertFileText(t, realFile, source)
  assertFileText(t, linkFile, source)
}
