package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies singular accepts merged declarations.
 *
 * Preserves the original consumer fixture and every diagnostic assertion.
 * Package registration, exit status and diagnostic rendering run together in
 * the batched consumer contract; this case calls the actual Go rule directly.
 *
 * 1. Parse the unchanged TypeScript inputs with the production parser.
 * 2. Invoke the rule for every source in one Go test process.
 * 3. Assert the original positive, negative and boundary expectations.
 */
func TestEvidenceSemanticSingularAcceptsMergedDeclarations(t *testing.T) {
  files := map[string]string{
    "src/ISomething.ts": "export interface ISomething {\n  id: string;\n}\nexport namespace ISomething {\n  export interface ICreate {\n    id: string;\n  }\n}\n",
    "src/Something.ts":  "export class Something {}\nexport namespace Something {\n  export const version: string = \"1\";\n}\n",
    "src/handler.ts":    "export const handler = (): void => {};\nexport default handler;\n",
    "src/index.ts":      "export * from \"./ISomething.js\";\nexport * from \"./Something.js\";\nexport * from \"./handler.js\";\n",
  }
  messages := []string{}
  for file, content := range files {
    messages = append(messages, runSingularRule(t, file, content)...)
  }
  output := strings.Join(messages, "\n")
  if len(messages) != 0 {
    t.Fatalf("unexpected findings: %s", output)
  }
  if strings.Contains(output, "evidence/singular") {
    t.Fatalf("unexpected %q in %s", "evidence/singular", output)
  }
}
