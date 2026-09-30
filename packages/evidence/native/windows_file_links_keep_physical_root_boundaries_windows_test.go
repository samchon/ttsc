//go:build windows

package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies Windows junction traversal: linked roots preserve identity while nested escapes remain forbidden.
 *
 * An explicitly linked root is a selected directory. A nested link cannot
 * silently add an unconfigured implementation or duplicate an existing unit.
 *
 * 1. Select one physical module through its directory and an explicit root link.
 * 2. Assert a single citation acknowledges both populations.
 * 3. Add a nested link outside the root and verify traversal fails.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies linked roots preserve identity while nested escapes remain forbidden.
 *
 * @evidence contracts/testing.md#independent-expectations Two explicit roots reaching one physical value owe one obligation; a nested escape to the different outside value must report the rooted traversal restriction.
 *
 * @evidence contracts/testing.md#distinguishing-cases Select one physical module through its directory and an explicit root link. Assert a single citation acknowledges both populations. Add a nested link outside the root and verify traversal fails.
 *
 * @evidence contracts/testing.md#execution-ownership TestWindowsFileLinksKeepPhysicalRootBoundaries is the Windows-only Go entry in the existing installed-SDK kernel batch. It calls the shared linkWindowsPopulationDirectory fixture producer and graphRule.Check in the batch native process; Markdown/TypeScript inputs do not activate Prisma or Swagger loaders.
 *
 * @evidence contracts/e2e.md#necessary-boundary The shared producer creates actual Windows directory junctions through cmd.exe and mklink /J. Root identity and module traversal consume the resulting reparse points; a portable symbolic-link fixture cannot establish this kernel connection. This case accepts two explicitly selected paths to one physical unit and rejects a nested junction escaping the selected root; it covers identity deduplication and containment together.
 *
 * @evidence contracts/e2e.md#shared-execution The existing Windows batch reuses its installed candidate SDK and one Go test artifact/process for all kernel cases. This entry creates only its conflicting fixture paths and junctions; graph evaluations reuse that fixture without an installation, native build, or product host per evaluation.
 *
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity newFileLinkFixture owns this entry's t.TempDir directory, JSON options, parsed sources, and file edits. The command producer returns after each junction is created, and Go testing cleans the fixture on success or failure. Distinct project roots prevent another case's files or mutable snapshot slice from supplying these assertions. This case accepts two explicitly selected paths to one physical unit and rejects a nested junction escaping the selected root; it covers identity deduplication and containment together.
 *
 * @evidence contracts/e2e.md#preserved-coverage TestWindowsFileLinksKeepPhysicalRootBoundaries keeps the original TestFileLinksKeepPhysicalRootBoundaries fixture inputs and every graph assertion, changing only the directory-link producer to the shared Windows junction operation. The original portable symbolic-link entry remains selectable in the Linux unit population. This case accepts two explicitly selected paths to one physical unit and rejects a nested junction escaping the selected root; it covers identity deduplication and containment together.
 */
func TestWindowsFileLinksKeepPhysicalRootBoundaries(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/value.ts": "export const value = 1;", "outside/value.ts": "export const value = 2;", "review.md": "## Review\n<!-- @link api/value.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":[{"type":"typescript","root":"api","files":["value.ts"],"symbol":"property"},{"type":"typescript","root":"linked","files":["value.ts"],"symbol":"property"}]}]}`)
  if err := linkWindowsPopulationDirectory(filepath.Join(fixture.root, "api"), filepath.Join(fixture.root, "linked")); err != nil {
    t.Fatal(err)
  }
  assertNoProblems(t, fixture.check())
  if err := linkWindowsPopulationDirectory(filepath.Join(fixture.root, "outside"), filepath.Join(fixture.root, "api/escape")); err != nil {
    t.Fatal(err)
  }
  fixture.write("api/value.ts", "export { value } from './escape/value';")
  assertProblemContains(t, fixture.check(), "re-export leaves the explicitly configured root")
}
