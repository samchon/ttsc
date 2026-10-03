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
 * @evidence contracts/testing.md#behavioral-verification For entry modules `value.ts` and `index.ts` (a star barrel of value.ts), newFileLinkFixture builds `export const value = 1; export { missing };` and a link to `#value`; each check must contain `exported binding 'missing' has no declaration` and no `Missing acknowledgement`, and after declaring `const missing = 2` and linking both names the check must be clean.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the export contract: an export-list entry is not a declaration, the undeclared binding must be diagnosed whether the entry is direct or forwarded by a star, and partial input must not produce coverage findings.
 * @evidence contracts/testing.md#distinguishing-cases Direct and star-forwarded entries (two plain-loop iterations) each with a failing and a repaired stage; the real `value` beside the undeclared binding must not hide the failure.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksRejectMissingLocalExports is a Go unit entry in the native test process that loops over two entries (not named subtests); each drives graphRule.Check through newFileLinkFixture over real temp files, with no consumer install or product host.
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
