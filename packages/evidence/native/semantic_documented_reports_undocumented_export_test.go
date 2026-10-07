package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies documented reports undocumented export.
 *
 * Documented parse versus undocumented render distinguishes absence from ordinary prose; empty blocks have their own test.
 *
 * 1. documentedRule.Check reports only the render export without JSDoc and explains why citations require a block.
 * 2. Literal render identity and the JSDoc-only repair fragment are independent expectations; exactly one finding prevents rejecting documented parse.
 *
 * @evidence contracts/testing.md#behavioral-verification documentedRule.Check reports only the render export without JSDoc and explains why citations require a block.
 * @evidence contracts/testing.md#independent-expectations Literal render identity and the JSDoc-only repair fragment are independent expectations; exactly one finding prevents rejecting documented parse.
 * @evidence contracts/testing.md#distinguishing-cases Documented parse versus undocumented render distinguishes absence from ordinary prose; empty blocks have their own test.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticDocumentedReportsUndocumentedExport owns these assertions. runDocumentedRule calls documentedRule.Check on the preserved two-function source without an installed consumer or product host.
 */
func TestEvidenceSemanticDocumentedReportsUndocumentedExport(t *testing.T) {
  files := map[string]string{
    "src/parse.ts": "/** Normalizes a raw input value. */\nexport function parse(value: string): string {\n  return value;\n}\n\nexport function render(value: string): string {\n  return value;\n}\n",
  }
  messages := []string{}
  for file, content := range files {
    messages = append(messages, runDocumentedRule(t, file, content, "")...)
  }
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Missing JSDoc on exported function 'render'") {
    t.Fatalf("missing %q in %s", "Missing JSDoc on exported function 'render'", output)
  }
  if !strings.Contains(output, "only ever read from a JSDoc block") {
    t.Fatalf("missing %q in %s", "only ever read from a JSDoc block", output)
  }
  if len(messages) != 1 {
    t.Fatalf("only undocumented render must fail, got %d: %s", len(messages), output)
  }

}
