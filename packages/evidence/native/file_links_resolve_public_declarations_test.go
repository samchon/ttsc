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
 * 3. Add another selected module with the same execute name and verify its unit remains owed.
 *
 * @evidence contracts/testing.md#behavioral-verification For a Markdown host and a TypeScript host (two t.Run rows), links to `execute`, `Target` and `Namespace.property` of src/example.ts must be clean under a reference over that one file; adding src/other.ts with its own `execute` function under a `src/**` reference must produce diagnostics containing `src/other.ts` and `Missing acknowledgement`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the addressing contract: file-qualified links replace import scope without changing containment, so they acknowledge the three units of one module, and a same-named export in another file remains an independent unit that stays owed.
 * @evidence contracts/testing.md#distinguishing-cases The same citations under a one-file and a two-file population, from both host kinds; the second module's `execute` is the independently owed unit.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksResolvePublicDeclarations is a Go unit entry in the native test process that owns two t.Run rows (markdown, typescript); runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
