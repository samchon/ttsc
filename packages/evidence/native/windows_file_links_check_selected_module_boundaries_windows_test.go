//go:build windows

package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies Windows junction traversal: root containment judges the selected module, not an extensionless path.
 *
 * A same-named directory can exist beside value.ts and is not its identity.
 * Resolving a directory link before module substitution rejects a valid file.
 *
 * 1. Re-export value.ts beside a value/ directory linked outside the root.
 * 2. Verify the file wins and its citation succeeds.
 * 3. Remove that candidate and verify a directory entry outside the root fails.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies root containment judges the selected module, not an extensionless path.
 *
 * @evidence contracts/testing.md#independent-expectations The .ts file wins before its adjacent linked directory; deleting that file makes the re-export leave the explicitly selected root and must report that reason.
 *
 * @evidence contracts/testing.md#distinguishing-cases Re-export value.ts beside a value/ directory linked outside the root. Verify the file wins and its citation succeeds. Remove that candidate and verify a directory entry outside the root fails.
 *
 * @evidence contracts/testing.md#execution-ownership TestWindowsFileLinksCheckSelectedModuleBoundaries is the Windows-only Go entry in the existing installed-SDK kernel batch. It calls the shared linkWindowsPopulationDirectory fixture producer and graphRule.Check in the batch native process; Markdown/TypeScript inputs do not activate Prisma or Swagger loaders.
 *
 * @evidence contracts/e2e.md#necessary-boundary The shared producer creates actual Windows directory junctions through cmd.exe and mklink /J. Root identity and module traversal consume the resulting reparse points; a portable symbolic-link fixture cannot establish this kernel connection. This case distinguishes module substitution from the adjacent junction: value.ts wins before deletion; afterward the junction points outside the selected root and must be rejected.
 *
 * @evidence contracts/e2e.md#shared-execution The existing Windows batch reuses its installed candidate SDK and one Go test artifact/process for all kernel cases. This entry creates only its conflicting fixture paths and junctions; graph evaluations reuse that fixture without an installation, native build, or product host per evaluation.
 *
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity newFileLinkFixture owns this entry's t.TempDir directory, JSON options, parsed sources, and file edits. The command producer returns after each junction is created, and Go testing cleans the fixture on success or failure. Distinct project roots prevent another case's files or mutable snapshot slice from supplying these assertions. This case distinguishes module substitution from the adjacent junction: value.ts wins before deletion; afterward the junction points outside the selected root and must be rejected.
 *
 * @evidence contracts/e2e.md#preserved-coverage TestWindowsFileLinksCheckSelectedModuleBoundaries keeps the original TestFileLinksCheckSelectedModuleBoundaries fixture inputs and every graph assertion, changing only the directory-link producer to the shared Windows junction operation. The original portable symbolic-link entry remains selectable in the Linux unit population. This case distinguishes module substitution from the adjacent junction: value.ts wins before deletion; afterward the junction points outside the selected root and must be rejected.
 */
func TestWindowsFileLinksCheckSelectedModuleBoundaries(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/index.ts": "export { value } from './value';", "api/value.ts": "export const value = 1;", "outside/index.ts": "export const value = 2;", "review.md": "## Review\n<!-- @link api/index.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
  if err := linkWindowsPopulationDirectory(filepath.Join(fixture.root, "outside"), filepath.Join(fixture.root, "api/value")); err != nil {
    t.Fatal(err)
  }
  assertNoProblems(t, fixture.check())
  if err := os.Remove(filepath.Join(fixture.root, "api/value.ts")); err != nil {
    t.Fatal(err)
  }
  assertProblemContains(t, fixture.check(), "re-export leaves the explicitly configured root")
}
