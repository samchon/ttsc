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
