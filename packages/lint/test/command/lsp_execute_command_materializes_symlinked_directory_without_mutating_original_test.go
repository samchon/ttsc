package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPExecuteCommandMaterializesSymlinkedDirectoryWithoutMutatingOriginal
// verifies symlinked source directories do not leak temp writes to disk.
//
// VSCode command execution returns a WorkspaceEdit and must not rewrite the
// user's saved files while computing cascaded fixes. A temp workspace that
// preserves a symlinked `src` directory would either miss the file or write
// through to the original target.
//
// 1. Seed a project whose `src` directory is a symlink to another directory.
// 2. Execute `ttsc.lint.fixAll` against the visible symlink path.
// 3. Assert the returned WorkspaceEdit fixes the document.
// 4. Assert both the symlink path and backing file still contain source text.
// @evidence contracts/testing.md#behavioral-verification Fix-all stages a symlinked source directory and returns the literal source rewrite while both linked and backing reads retain the original.
// @evidence contracts/testing.md#independent-expectations The original/fixed fixture texts independently define edit correctness and non-mutation across the supplied directory alias.
// @evidence contracts/testing.md#distinguishing-cases The whole src directory is a symlink to real-src, so a staging copy that preserved the link would either miss the file or write through to the backing directory; the literal let rewrite must be returned and both the link path and backing file must still read the original var text. The test skips where symlinks cannot be created.
// @evidence contracts/testing.md#execution-ownership TestLSPExecuteCommandMaterializesSymlinkedDirectoryWithoutMutatingOriginal owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
func TestLSPExecuteCommandMaterializesSymlinkedDirectoryWithoutMutatingOriginal(t *testing.T) {
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
  realDir := filepath.Join(root, "real-src")
  realFile := filepath.Join(realDir, "main.ts")
  writeFile(t, realFile, source)
  linkDir := filepath.Join(root, "src")
  if err := os.Symlink(realDir, linkDir); err != nil {
    t.Skipf("symlink unavailable: %v", err)
  }
  linkFile := filepath.Join(linkDir, "main.ts")
  uri := lintTestFileURI(t, linkFile)

  got := executeLSPCommandAppliedTextForTest(t, root, uri, commandLintFixAll, source)
  want := "let legacy = 1;\nJSON.stringify(legacy);\nexport {};\n"
  if got != want {
    t.Fatalf("symlinked directory LSP fix text mismatch:\nwant %q\ngot  %q", want, got)
  }
  assertFileText(t, realFile, source)
  assertFileText(t, linkFile, source)
}
