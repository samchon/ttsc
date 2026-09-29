package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies singular reports second identity.
 *
 * Preserves the original consumer fixture and every diagnostic assertion.
 * Package registration, exit status and diagnostic rendering run together in
 * the batched consumer contract; this case calls the actual Go rule directly.
 *
 * 1. Parse the unchanged TypeScript inputs with the production parser.
 * 2. Invoke the rule for every source in one Go test process.
 * 3. Assert the original positive, negative and boundary expectations.
 */
func TestEvidenceSemanticSingularReportsSecondIdentity(t *testing.T) {
  files := map[string]string{
    "src/pair.ts":  "export const alpha = 1;\nexport const beta = 2;\n",
    "src/utils.ts": "export function parseInput(value: string): string {\n  return value;\n}\n",
  }
  messages := []string{}
  for file, content := range files {
    messages = append(messages, runSingularRule(t, file, content)...)
  }
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "declares exactly one public identity") {
    t.Fatalf("missing %q in %s", "declares exactly one public identity", output)
  }
  if !strings.Contains(output, "Rename the file to 'parseInput.ts'") {
    t.Fatalf("missing %q in %s", "Rename the file to 'parseInput.ts'", output)
  }
}
