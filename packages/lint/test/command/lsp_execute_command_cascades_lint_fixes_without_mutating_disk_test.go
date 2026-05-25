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
func TestLSPExecuteCommandCascadesLintFixesWithoutMutatingDisk(t *testing.T) {
  source := "var legacy = 1;\nlet stable = legacy;\nif (typeof stable == \"number\") { JSON.stringify(stable); }\n"
  want := "const legacy = 1;\nconst stable = legacy;\nif (typeof stable === \"number\") { JSON.stringify(stable); }\n"
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
