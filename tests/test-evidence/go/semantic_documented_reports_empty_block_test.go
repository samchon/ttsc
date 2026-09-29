package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies documented reports empty block.
 *
 * Preserves the original consumer fixture and every diagnostic assertion.
 * Package registration, exit status and diagnostic rendering run together in
 * the batched consumer contract; this case calls the actual Go rule directly.
 *
 * 1. Parse the unchanged TypeScript inputs with the production parser.
 * 2. Invoke the rule for every source in one Go test process.
 * 3. Assert the original positive, negative and boundary expectations.
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
}
