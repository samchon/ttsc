package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies documented reports empty block.
 *
 * Nonempty parse documentation contrasts with an empty render block in the same source; the missing-block case is owned by ReportsUndocumentedExport.
 *
 * 1. documentedRule.Check reports the empty render JSDoc and leaves the described parse function alone.
 * 2. The literal Empty JSDoc on exported function render message and exact one-finding count distinguish empty from missing/nonempty blocks.
 *
 * @evidence contracts/testing.md#behavioral-verification documentedRule.Check reports the empty render JSDoc and leaves the described parse function alone.
 * @evidence contracts/testing.md#independent-expectations The literal Empty JSDoc on exported function render message and exact one-finding count distinguish empty from missing/nonempty blocks.
 * @evidence contracts/testing.md#distinguishing-cases Nonempty parse documentation contrasts with an empty render block in the same source; the missing-block case is owned by ReportsUndocumentedExport.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticDocumentedReportsEmptyBlock owns these assertions. runDocumentedRule parses src/parse.ts and invokes documentedRule.Check once in process; this test owns both declarations.
 */
func TestEvidenceSemanticDocumentedReportsEmptyBlock(t *testing.T) {
  files := map[string]string{
    "src/parse.ts": "/** Normalizes a raw input value. */\nexport function parse(value: string): string {\n  return value;\n}\n\n/** */\nexport function render(value: string): string {\n  return value;\n}\n",
  }
  messages := []string{}
  for file, content := range files {
    messages = append(messages, runDocumentedRule(t, file, content, "")...)
  }
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Empty JSDoc on exported function 'render'") {
    t.Fatalf("missing %q in %s", "Empty JSDoc on exported function 'render'", output)
  }
  if len(messages) != 1 {
    t.Fatalf("only the empty render block must fail, got %d: %s", len(messages), output)
  }

}
