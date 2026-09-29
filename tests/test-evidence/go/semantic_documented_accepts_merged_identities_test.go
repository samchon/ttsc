package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies documented accepts merged identities.
 *
 * Preserves the original consumer fixture and every diagnostic assertion.
 * Package registration, exit status and diagnostic rendering run together in
 * the batched consumer contract; this case calls the actual Go rule directly.
 *
 * 1. Parse the unchanged TypeScript inputs with the production parser.
 * 2. Invoke the rule for every source in one Go test process.
 * 3. Assert the original positive, negative and boundary expectations.
 */
func TestEvidenceSemanticDocumentedAcceptsMergedIdentities(t *testing.T) {
  files := map[string]string{
    "src/ISale.ts":        "/** A sale offered to a customer. */\nexport interface ISale {\n  /** Identifier of the sale. */\n  id: string;\n}\nexport namespace ISale {\n  /** Creation input. */\n  export interface ICreate {\n    /** Identifier of the sale. */\n    id: string;\n  }\n}\n",
    "src/Something.ts":    "/** The exported service. */\nexport class Something {}\nexport namespace Something {\n  /** Current version. */\n  export const version = \"1\";\n}\n",
    "src/format.ts":       "/** Renders a string for display. */\nexport function format(value: string): string;\n/** Renders a number for display. */\nexport function format(value: number): string;\n/** Renders either for display. */\nexport function format(value: string | number): string {\n  return String(value);\n}\n",
    "src/evidence.ts":     "/** The exported descriptor. */\nexport const evidence = { name: \"evidence\" };\n/** The default export of this module. */\nexport default evidence;\n",
    "src/Undocumented.ts": "export interface Undocumented {}\n",
  }
  messages := []string{}
  for file, content := range files {
    messages = append(messages, runDocumentedRule(t, file, content, "")...)
  }
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Missing JSDoc on exported type 'Undocumented'") {
    t.Fatalf("missing %q in %s", "Missing JSDoc on exported type 'Undocumented'", output)
  }
  if strings.Contains(output, "'ISale'") {
    t.Fatalf("unexpected %q in %s", "'ISale'", output)
  }
  if strings.Contains(output, "'Something'") {
    t.Fatalf("unexpected %q in %s", "'Something'", output)
  }
  if strings.Contains(output, "'format'") {
    t.Fatalf("unexpected %q in %s", "'format'", output)
  }
  if strings.Contains(output, "'evidence'") {
    t.Fatalf("unexpected %q in %s", "'evidence'", output)
  }
}
