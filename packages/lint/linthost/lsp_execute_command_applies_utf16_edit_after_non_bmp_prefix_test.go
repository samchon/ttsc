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
// 4. Assert the command rewrite preserves every other source byte.
// 5. Apply a literal partial keyword range after the emoji with the test helper.
//
// @evidence contracts/testing.md#behavioral-verification Fix-all preserves the authored astral-prefix source while changing var to let. A separate literal UTF-16 keyword range on that same source makes the test applier replace var rather than adjacent bytes.
// @evidence contracts/testing.md#independent-expectations The authored full source with only var changed to let is the independent answer key. Literal line-zero columns 19 through 22 count the emoji as two UTF-16 units; byte and scalar columns differ.
// @evidence contracts/testing.md#distinguishing-cases The directly authored partial keyword edit after the non-BMP prefix separates UTF-16 units from scalar and byte offsets. The command itself returns a full-document edit ending after the final newline, so that command result alone does not exercise a non-BMP end column.
// @evidence contracts/testing.md#execution-ownership The source-only no-var LSP command and two test-side edit applications run in one Go unit process without a requested checker or editor subprocess. The authored partial range verifies the applier; it does not certify a production partial edit returned by fix-all.
func TestLSPExecuteCommandAppliesUTF16EditAfterNonBMPPrefix(t *testing.T) {
  source := "const face = \"😀\"; var legacy = 1;\nJSON.stringify(face, legacy);\nexport {};\n"
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))

  got := executeLSPCommandAppliedTextForTest(t, root, uri, commandLintFixAll, source)
  want := "const face = \"😀\"; let legacy = 1;\nJSON.stringify(face, legacy);\nexport {};\n"
  if got != want {
    t.Fatalf("UTF-16 LSP edit text mismatch:\nwant %q\ngot  %q", want, got)
  }
  // Fourteen ASCII units precede the emoji, then two emoji units and
  // the closing quote, semicolon and space put var at UTF-16 column 19.
  keyword := []lspTextEdit{{
    Range: lspRange{
      Start: lspPosition{Line: 0, Character: 19},
      End:   lspPosition{Line: 0, Character: 22},
    },
    NewText: "let",
  }}
  if got := applyLSPWorkspaceEditForTest(t, source, keyword); got != want {
    t.Fatalf("authored partial UTF-16 edit mismatch:\nwant %q\ngot  %q", want, got)
  }
}
