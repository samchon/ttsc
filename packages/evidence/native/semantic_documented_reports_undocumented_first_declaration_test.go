package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies documented reports undocumented first declaration.
 *
 * Interface/namespace, class/namespace and named/default merges all have a documented later declaration but an undocumented first declaration.
 *
 * 1. Later namespace/default documentation does not hide missing JSDoc on the first ISale, Something and evidence declarations.
 * 2. Three independently named Missing JSDoc messages and exact count three require one finding for each first identity.
 *
 * @evidence contracts/testing.md#behavioral-verification Later namespace/default documentation does not hide missing JSDoc on the first ISale, Something and evidence declarations.
 * @evidence contracts/testing.md#independent-expectations Three independently named Missing JSDoc messages and exact count three require one finding for each first identity.
 * @evidence contracts/testing.md#distinguishing-cases Interface/namespace, class/namespace and named/default merges all have a documented later declaration but an undocumented first declaration.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticDocumentedReportsUndocumentedFirstDeclaration owns these assertions. runDocumentedRule parses and checks all three literal fixture modules in this one Go test; aggregated messages retain their named identities.
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
  if len(messages) != 3 {
    t.Fatalf("each of the three first identities must fail once, got %d: %s", len(messages), output)
  }

}
