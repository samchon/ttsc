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
 * @evidence contracts/testing.md#behavioral-verification For each root spelling `.`, `./` and `a/..` the test builds a Markdown-only project with a disk file external/value.ts and a TypeScript reference with that `root`; graphRule.Check over an empty Program must give no diagnostics and declaredInputs must declare exactly the globs `review.md` and `**`; with no `root` the same link must report `Out-of-population`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the root contract: an explicitly written root, even one that normalizes to the project directory, opts into disk loading and watching the whole project, while omitting it leaves the disk-only file out of the population.
 * @evidence contracts/testing.md#distinguishing-cases Three spellings that normalize to the same empty path against the omitted-root control; the control fails if presence of the property were lost in normalization.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksKeepExplicitProjectRoot is a Go unit entry in the native test process that loops over three spellings (not named subtests); it calls graphRule.Check through newFileLinkFixture over real temp files and ProjectInputs on in-memory options, with no watcher, consumer install or product host.
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
