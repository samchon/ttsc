package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies documented narrows to selected symbols.
 *
 * Preserves the original consumer fixture and every diagnostic assertion.
 * Package registration, exit status and diagnostic rendering run together in
 * the batched consumer contract; this case calls the actual Go rule directly.
 *
 * 1. Parse the unchanged TypeScript inputs with the production parser.
 * 2. Invoke the rule for every source in one Go test process.
 * 3. Assert the original positive, negative and boundary expectations.
 */
func TestEvidenceSemanticDocumentedNarrowsToSelectedSymbols(t *testing.T) {
  files := map[string]string{
    "src/ISale.ts": "/** A sale offered to a customer. */\nexport interface ISale {\n  price: number;\n}\n\nexport function total(sale: ISale): number {\n  return sale.price;\n}\n",
  }
  messages := []string{}
  for file, content := range files {
    messages = append(messages, runDocumentedRule(t, file, content, "{\"symbol\":\"type\"}")...)
  }
  output := strings.Join(messages, "\n")
  if len(messages) != 0 {
    t.Fatalf("unexpected findings: %s", output)
  }
  if strings.Contains(output, "evidence/documented") {
    t.Fatalf("unexpected %q in %s", "evidence/documented", output)
  }
}
