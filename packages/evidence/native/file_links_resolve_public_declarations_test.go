package evidence

import "testing"

/**
 * Verifies Markdown and TypeScript file links name the same public code units.
 *
 * File identity replaces import scope without changing containment or selectors.
 * The same-named export in another file must remain independently owed.
 *
 * 1. Select functions, a class, and namespace members from two modules.
 * 2. Cite them from both supported host kinds without imports.
 * 3. Remove one citation and verify only that file's unit remains owed.
 */
func TestFileLinksResolvePublicDeclarations(t *testing.T) {
  contracts := `export function execute(): void {}
export class Target { static property = "ready"; value = 1; }
export namespace Namespace { export const property = true; }
`
  for _, host := range []string{"markdown", "typescript"} {
    t.Run(host, func(t *testing.T) {
      tags := "@link ../src/example.ts#execute Calls the operation.\n@link ../src/example.ts#Target Reviews the class.\n@link ../src/example.ts#Namespace.property Checks the flag.\n"
      file, content, symbol := "docs/review.md", "## Review\n<!-- "+tags+" -->\n", "h2"
      if host == "typescript" {
        file, content, symbol = "docs/review.ts", "/**\n"+tags+"*/\nexport interface Review {}\n", "type"
      }
      config := `{"claims":[{"type":"` + host + `","files":["` + file + `"],"symbol":"` + symbol + `","reference":{"type":"typescript","files":["src/example.ts"],"symbol":["function","property"]}}]}`
      assertNoProblems(t, runIndexRule(t, map[string]string{file: content, "src/example.ts": contracts}, config))
      config = `{"claims":[{"type":"` + host + `","files":["` + file + `"],"symbol":"` + symbol + `","reference":{"type":"typescript","files":["src/**"],"symbol":["function","property"]}}]}`
      messages := runIndexRule(t, map[string]string{file: content, "src/example.ts": contracts, "src/other.ts": "export function execute(): void {}\n"}, config)
      assertProblemContains(t, messages, "src/other.ts")
      assertProblemContains(t, messages, "Missing acknowledgement")
    })
  }
}
