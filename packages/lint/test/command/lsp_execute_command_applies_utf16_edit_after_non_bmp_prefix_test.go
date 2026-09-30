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
// @evidence contracts/testing.md#behavioral-verification Fix-all returns an edit after an astral prefix that the independent test applier must land on var rather than adjacent bytes.
// @evidence contracts/testing.md#independent-expectations The authored full source with only var changed to let independently constrains UTF-16 column conversion and preserved astral text.
// @evidence contracts/testing.md#distinguishing-cases The non-BMP prefix separates UTF-16 units from scalar and byte offsets, unlike ASCII-only fix fixtures.
// @evidence contracts/testing.md#execution-ownership The Go LSP host, checker and test-side UTF-16 edit application run in the one unit process; this proves returned edit coordinates without an editor subprocess.
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
