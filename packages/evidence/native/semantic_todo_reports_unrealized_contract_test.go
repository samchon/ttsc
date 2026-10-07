package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies todo reports unrealized contract.
 *
 * The exact @todo spelling contrasts with @todos on parse, which must remain silent and absent from findings.
 *
 * 1. todoRule.Check reports only persist with the exact @todo tag and its wire the persistence layer text.
 * 2. The literal Unrealized @todo and realize/remove repair fragments plus exactly one finding are independent of the tag parser.
 *
 * @evidence contracts/testing.md#behavioral-verification todoRule.Check reports only persist with the exact @todo tag and its wire the persistence layer text.
 * @evidence contracts/testing.md#independent-expectations The literal Unrealized @todo and realize/remove repair fragments plus exactly one finding are independent of the tag parser.
 * @evidence contracts/testing.md#distinguishing-cases The exact @todo spelling contrasts with @todos on parse, which must remain silent and absent from findings.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticTodoReportsUnrealizedContract owns these assertions. runTodoRule parses the two-function fixture and calls todoRule.Check with its supported no-options form in the shared Go unit process.
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
  if len(messages) != 1 {
    t.Fatalf("only the exact @todo tag must fail, got %d: %s", len(messages), output)
  }

}
