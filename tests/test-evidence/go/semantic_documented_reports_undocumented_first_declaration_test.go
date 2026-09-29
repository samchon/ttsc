package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies documented reports undocumented first declaration.
 *
 * Preserves the original consumer fixture and every diagnostic assertion.
 * Package registration, exit status and diagnostic rendering run together in
 * the batched consumer contract; this case calls the actual Go rule directly.
 *
 * 1. Parse the unchanged TypeScript inputs with the production parser.
 * 2. Invoke the rule for every source in one Go test process.
 * 3. Assert the original positive, negative and boundary expectations.
 */
func TestEvidenceSemanticDocumentedReportsUndocumentedFirstDeclaration(t *testing.T) {
  files := map[string]string{
    "src/ISale.ts":     "export interface ISale {\n  /** Identifier of the sale. */\n  id: string;\n}\n/** A sale offered to a customer. */\nexport namespace ISale {\n  /** Creation input. */\n  export interface ICreate {\n    /** Identifier of the sale. */\n    id: string;\n  }\n}\n",
    "src/Something.ts": "export class Something {}\n/** The exported service. */\nexport namespace Something {\n  /** Current version. */\n  export const version = \"1\";\n}\n",
    "src/evidence.ts":  "export const evidence = { name: \"evidence\" };\n/** The exported plugin descriptor. */\nexport default evidence;\n",
  }
  messages := []string{}
  for file, content := range files {
    messages = append(messages, runDocumentedRule(t, file, content, "")...)
  }
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Missing JSDoc on exported type 'ISale'") {
    t.Fatalf("missing %q in %s", "Missing JSDoc on exported type 'ISale'", output)
  }
  if !strings.Contains(output, "Missing JSDoc on exported type 'Something'") {
    t.Fatalf("missing %q in %s", "Missing JSDoc on exported type 'Something'", output)
  }
  if !strings.Contains(output, "Missing JSDoc on exported property 'evidence'") {
    t.Fatalf("missing %q in %s", "Missing JSDoc on exported property 'evidence'", output)
  }
}
