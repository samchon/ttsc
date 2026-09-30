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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies Markdown and TypeScript file links name the same public code units.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The authored functions/class/namespace citations acknowledge one module, while adding the other module introduces an independently owed same-named execute function.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select functions, a class, and namespace members from two modules. Cite them from both supported host kinds without imports. Add another selected module with the same execute name and verify its unit remains owed.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFileLinksResolvePublicDeclarations is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
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
