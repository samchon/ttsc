package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPFixAllLeavesSuggestionOnlyRewritesUnchanged verifies source.fixAll.ttsc
// consumes only Finding.Fix and returns no workspace edit for the two opt-in
// rewrites.
//
// @evidence contracts/testing.md#behavioral-verification Fix-all returns no edit for await-thenable and ban-ts-comment suggestions and leaves the original disk source unchanged.
// @evidence contracts/testing.md#independent-expectations A nil edit and exact original source are independent negative expectations; the dedicated signed-action hosts separately specify successful opt-in rewrites.
// @evidence contracts/testing.md#distinguishing-cases Two different manual-only suggestions in the same source reject either automatic directive replacement or await deletion.
// @evidence contracts/testing.md#execution-ownership The in-process Go checker and fix-all path inspect this fixture without executing JavaScript or compiling an installed plugin.
func TestLSPFixAllLeavesSuggestionOnlyRewritesUnchanged(t *testing.T) {
  source := `// @ts-ignore: the next line is intentionally error-free
const value: number = 1;
async function main(): Promise<void> {
  await value;
}
void main();
`
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "typescript/await-thenable": "error",
      "typescript/ban-ts-comment": "error",
    },
  })
  file := filepath.Join(root, "src", "main.ts")
  uri := lintTestFileURI(t, file)
  if edit := executeLSPCommandEditForTest(t, root, uri, commandLintFixAll); edit != nil {
    t.Fatalf("source.fixAll.ttsc returned suggestion edits: %+v", edit)
  }
  assertFileText(t, file, source)
}
