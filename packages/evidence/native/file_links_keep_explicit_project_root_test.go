package evidence

import (
  "github.com/samchon/ttsc/packages/lint/rule"
  "testing"
)

/**
 * Verifies an explicit project root remains a disk-loading and watch opt-in.
 *
 * Root normalization collapses '.', './', and 'a/..' to the same empty path.
 * Presence must survive that normalization so an absent Program is sufficient.
 *
 * 1. Configure each spelling over a TypeScript file absent from the Program.
 * 2. Assert the file link resolves and the project directory is declared.
 * 3. Omit root and verify the same disk file is not implicitly selected.
 */
func TestFileLinksKeepExplicitProjectRoot(t *testing.T) {
  for _, root := range []string{".", "./", "a/.."} {
    options := `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"` + root + `","files":["external/*.ts"],"symbol":"property"}}]}`
    fixture := newFileLinkFixture(t, map[string]string{"review.md": "## Review\n<!-- @link external/value.ts#value Reads the value. -->\n", "external/value.ts": "export const value = 1;"}, options)
    assertNoProblems(t, fixture.check())
    assertDeclares(t, declaredInputs(t, options), rule.ProjectInputGlob, []string{"review.md", "**"})
  }
  fixture := newFileLinkFixture(t, map[string]string{"review.md": "## Review\n<!-- @link external/value.ts#value Reads the value. -->\n", "external/value.ts": "export const value = 1;"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["external/*.ts"],"symbol":"property"}}]}`)
  assertProblemContains(t, fixture.check(), "Out-of-population")
}
