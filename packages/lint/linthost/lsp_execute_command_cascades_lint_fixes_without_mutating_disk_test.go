package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPExecuteCommandCascadesLintFixesWithoutMutatingDisk verifies fix-all
// reaches the lint cascade fixed point.
//
// VSCode applies the returned WorkspaceEdit itself, so the sidecar must not
// mutate the user's workspace while computing multi-pass fixes. This pins the
// dependent no-var -> prefer-const rewrite and the separate eqeqeq rewrite through the LSP command path.
//
// 1. Seed a project whose lint fixes require multiple passes.
// 2. Execute `ttsc.lint.fixAll` through the LSP command path.
// 3. Apply the returned WorkspaceEdit in memory and assert the cascaded text.
// 4. Assert the source file on disk was not modified by the sidecar.
//
// @evidence contracts/testing.md#behavioral-verification ttsc.lint.fixAll returns the full authored lint cascade result and leaves the original source unchanged on disk.
// @evidence contracts/testing.md#independent-expectations The literal fixed text and original source bytes pin the lint transformations and non-mutation independently of generated WorkspaceEdit contents.
// @evidence contracts/testing.md#distinguishing-cases The first declaration is var and the second is already let, so prefer-const can only convert the first after no-var has made it block-scoped; the typeof loose equality is a third independent rewrite. The literal result requires all three rewrite families, without asserting an exact pass count; the disk file read back must still contain the original var source.
// @evidence contracts/testing.md#execution-ownership Calls run lsp-execute-command with the fix-all command in process through executeLSPCommandAppliedTextForTest, applies the returned edits to the in-memory source and reads the file back from disk; no editor or built host is started.
func TestLSPExecuteCommandCascadesLintFixesWithoutMutatingDisk(t *testing.T) {
  source := "var legacy = 1;\nlet stable = legacy;\nif (typeof stable == \"number\") { JSON.stringify(stable); }\nexport {};\n"
  want := "const legacy = 1;\nconst stable = legacy;\nif (typeof stable === \"number\") { JSON.stringify(stable); }\nexport {};\n"
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{
    "eqeqeq":       "error",
    "no-var":       "error",
    "prefer-const": "error",
  })
  file := filepath.Join(root, "src", "main.ts")
  uri := lintTestFileURI(t, file)

  got := executeLSPCommandAppliedTextForTest(t, root, uri, commandLintFixAll, source)
  if got != want {
    t.Fatalf("cascaded LSP fix text mismatch:\nwant %q\ngot  %q", want, got)
  }
  disk, err := os.ReadFile(file)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(disk) != source {
    t.Fatalf("LSP command mutated disk:\nwant %q\ngot  %q", source, string(disk))
  }
}
