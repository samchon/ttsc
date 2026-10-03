package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies singular accepts merged declarations.
 *
 * Interface/namespace, class/namespace, named/default and index barrel are permitted forms; an adjacent independent handler export is forbidden.
 *
 * 1. singularRule.Check counts merged interface/class namespaces and named/default aliases once, accepts a re-export barrel, and rejects added second identity.
 * 2. Original named filenames and literal distinct second export independently establish identity cardinality; the added control must name second in its finding.
 *
 * @evidence contracts/testing.md#behavioral-verification singularRule.Check counts merged interface/class namespaces and named/default aliases once, accepts a re-export barrel, and rejects added second identity.
 * @evidence contracts/testing.md#independent-expectations Original named filenames and literal distinct second export independently establish identity cardinality; the added control must name second in its finding.
 * @evidence contracts/testing.md#distinguishing-cases Interface/namespace, class/namespace, named/default and index barrel are permitted forms; an adjacent independent handler export is forbidden.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticSingularAcceptsMergedDeclarations owns these assertions. runSingularRule calls singularRule.Check on each original module and the handler-plus-second control after in-process parsing in independent named subcases, so either observation still runs after the other fails.
 */
func TestEvidenceSemanticSingularAcceptsMergedDeclarations(t *testing.T) {
  files := map[string]string{
    "src/ISomething.ts": "export interface ISomething {\n  id: string;\n}\nexport namespace ISomething {\n  export interface ICreate {\n    id: string;\n  }\n}\n",
    "src/Something.ts":  "export class Something {}\nexport namespace Something {\n  export const version: string = \"1\";\n}\n",
    "src/handler.ts":    "export const handler = (): void => {};\nexport default handler;\n",
    "src/index.ts":      "export * from \"./ISomething.js\";\nexport * from \"./Something.js\";\nexport * from \"./handler.js\";\n",
  }
  t.Run("original_merged", func(t *testing.T) {
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
  })
  t.Run("added_second", func(t *testing.T) {
    adjacent := files["src/handler.ts"] + "\nexport const second = 2;\n"
    rejected := strings.Join(runSingularRule(t, "src/handler.ts", adjacent), "\n")
    if !strings.Contains(rejected, "declares exactly one public identity") || !strings.Contains(rejected, "second") {
      t.Fatalf("a distinct identity beside the named/default alias must be rejected: %s", rejected)
    }
  })

}
