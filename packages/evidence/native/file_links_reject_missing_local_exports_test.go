package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a missing local export cannot disappear from a healthy population.
 *
 * An export-list entry alone is not a declaration. The valid sibling must not
 * conceal the missing binding, including when a barrel forwards that name.
 *
 * 1. Select a module with one real value and an undeclared exported binding.
 * 2. Assert the cause is diagnosed without deriving coverage from partial input.
 * 3. Declare and cite the missing value and verify recovery.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies a missing local export cannot disappear from a healthy population.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The undeclared missing binding is invalid in both direct and forwarding entries. Declaring and citing it restores coverage; partial-input findings must not report Missing acknowledgement.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select a module with one real value and an undeclared exported binding. Assert the cause is diagnosed without deriving coverage from partial input. Declare and cite the missing value and verify recovery.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFileLinksRejectMissingLocalExports is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the file-link fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestFileLinksRejectMissingLocalExports(t *testing.T) {
  for _, entry := range []string{"value.ts", "index.ts"} {
    fixture := newFileLinkFixture(t, map[string]string{"api/value.ts": "export const value = 1; export { missing };", "api/index.ts": "export * from './value';", "review.md": "## Review\n<!-- @link api/" + entry + "#value Reviews the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["`+entry+`"],"symbol":"property"}}]}`)
    messages := fixture.check()
    assertProblemContains(t, messages, "exported binding 'missing' has no declaration")
    if strings.Contains(strings.Join(messages, "\n"), "Missing acknowledgement") {
      t.Fatalf("partial coverage was judged: %v", messages)
    }
    fixture.write("api/value.ts", "export const value = 1; const missing = 2; export { missing };")
    fixture.write("review.md", "## Review\n<!-- @link api/"+entry+"#value Reviews value.\n@link api/"+entry+"#missing Reviews the restored value. -->\n")
    assertNoProblems(t, fixture.check())
  }
}
