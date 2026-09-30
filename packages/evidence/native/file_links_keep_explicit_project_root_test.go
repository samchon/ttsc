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
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check and graphRule.ProjectInputs exercises this case. Verifies an explicit project root remains a disk-loading and watch opt-in.
 *
 * @evidence contracts/testing.md#independent-expectations The root spellings ., ./, and a/.. explicitly authorize disk loading and the ** watch input; omitting root leaves the disk-only file out of population.
 *
 * @evidence contracts/testing.md#distinguishing-cases Configure each spelling over a TypeScript file absent from the Program. Assert the file link resolves and the project directory is declared. Omit root and verify the same disk file is not implicitly selected.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksKeepExplicitProjectRoot is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check and graphRule.ProjectInputs in the native Go process. Its graph calls read the owned fixture files with an empty Program; the separate ProjectInputs calls publish the declared watch globs without starting a watcher. No installed consumer, compiled host, Prisma loader, or Swagger loader participates.
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
