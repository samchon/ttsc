package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPFixAllLeavesSuggestionOnlyRewritesUnchanged verifies source.fixAll.ttsc
// consumes only Finding.Fix and returns no workspace edit for the two opt-in
// rewrites.
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
