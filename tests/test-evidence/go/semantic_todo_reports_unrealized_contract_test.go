package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies todo reports unrealized contract.
 *
 * Preserves the original consumer fixture and every diagnostic assertion.
 * Package registration, exit status and diagnostic rendering run together in
 * the batched consumer contract; this case calls the actual Go rule directly.
 *
 * 1. Parse the unchanged TypeScript inputs with the production parser.
 * 2. Invoke the rule for every source in one Go test process.
 * 3. Assert the original positive, negative and boundary expectations.
 */
func TestEvidenceSemanticTodoReportsUnrealizedContract(t *testing.T) {
  files := map[string]string{
    "src/parse.ts": "/** @todos are tracked elsewhere */\nexport function parse(value: string): string {\n  return value;\n}\n\n/** @todo wire the persistence layer */\nexport function persist(value: string): string {\n  return value;\n}\n",
  }
  messages := []string{}
  for file, content := range files {
    messages = append(messages, runTodoRule(t, file, content)...)
  }
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Unrealized '@todo': 'wire the persistence layer'") {
    t.Fatalf("missing %q in %s", "Unrealized '@todo': 'wire the persistence layer'", output)
  }
  if !strings.Contains(output, "Realize the declaration and remove the tag") {
    t.Fatalf("missing %q in %s", "Realize the declaration and remove the tag", output)
  }
  if strings.Contains(output, "tracked elsewhere") {
    t.Fatalf("unexpected %q in %s", "tracked elsewhere", output)
  }
}
