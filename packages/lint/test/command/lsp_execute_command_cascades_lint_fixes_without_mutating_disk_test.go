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
// no-var -> prefer-const -> eqeqeq cascade through the LSP command path.
//
// 1. Seed a project whose lint fixes require multiple passes.
// 2. Execute `ttsc.lint.fixAll` through the LSP command path.
// 3. Apply the returned WorkspaceEdit in memory and assert the cascaded text.
// 4. Assert the source file on disk was not modified by the sidecar.
// @evidence contracts/testing.md#behavioral-verification ttsc.lint.fixAll returns the full authored lint cascade result and leaves the original source unchanged on disk.
// @evidence contracts/testing.md#independent-expectations The literal fixed text and original source bytes pin the lint transformations and non-mutation independently of generated WorkspaceEdit contents.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Seed a project whose lint fixes require multiple passes. The asserted decision is: Assert the source file on disk was not modified by the sidecar. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestLSPExecuteCommandCascadesLintFixesWithoutMutatingDisk owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
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
