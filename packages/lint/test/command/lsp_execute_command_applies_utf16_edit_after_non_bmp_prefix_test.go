package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPExecuteCommandAppliesUTF16EditAfterNonBMPPrefix verifies test-side
// WorkspaceEdit application follows LSP UTF-16 positions.
//
// Production LSP ranges count non-BMP characters as two UTF-16 code units. The
// command tests apply returned edits in memory to model VSCode; if that helper
// counts Go runes instead, edits after an emoji are asserted at the wrong byte.
//
// 1. Seed a project whose `var` keyword appears after a non-BMP character.
// 2. Execute `ttsc.lint.fixAll` through the LSP command path.
// 3. Apply the returned WorkspaceEdit with the test helper.
// 4. Assert the edit lands on the keyword after the emoji.
func TestLSPExecuteCommandAppliesUTF16EditAfterNonBMPPrefix(t *testing.T) {
  source := "const face = \"😀\"; var legacy = 1;\nJSON.stringify(face, legacy);\n"
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))

  got := executeLSPCommandAppliedTextForTest(t, root, uri, commandLintFixAll, source)
  want := "const face = \"😀\"; let legacy = 1;\nJSON.stringify(face, legacy);\n"
  if got != want {
    t.Fatalf("UTF-16 LSP edit text mismatch:\nwant %q\ngot  %q", want, got)
  }
}
