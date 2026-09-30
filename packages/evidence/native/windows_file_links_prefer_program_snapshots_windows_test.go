//go:build windows

package evidence

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

/**
 * Verifies Windows junction traversal: an active Program snapshot wins over stale disk content in a root.
 *
 * An editor's parsed source can differ from disk, and cache reuse must follow
 * that source rather than keep either an old parse or the latest saved bytes.
 *
 * 1. Supply a Program export that differs from the file on disk.
 * 2. Verify repeated graph cycles use that snapshot.
 * 3. Replace the Program source and assert the citation becomes unresolved.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies an active Program snapshot wins over stale disk content in a root.
 *
 * @evidence contracts/testing.md#independent-expectations The Program exports value while disk exports stale, then the replacement snapshot exports renamed. Clean repeated and linked-root checks followed by missing-export failure distinguish snapshot precedence.
 *
 * @evidence contracts/testing.md#distinguishing-cases Supply a Program export that differs from the file on disk. Verify repeated graph cycles use that snapshot. Replace the Program source and assert the citation becomes unresolved.
 *
 * @evidence contracts/testing.md#execution-ownership TestWindowsFileLinksPreferProgramSnapshots is the Windows-only Go entry in the existing installed-SDK kernel batch. It calls the shared linkWindowsPopulationDirectory fixture producer and graphRule.Check in the batch native process; Markdown/TypeScript inputs do not activate Prisma or Swagger loaders.
 *
 * @evidence contracts/e2e.md#necessary-boundary The shared producer creates actual Windows directory junctions through cmd.exe and mklink /J. Root identity and module traversal consume the resulting reparse points; a portable symbolic-link fixture cannot establish this kernel connection. This case distinguishes live Program value from stale disk bytes across repeated and junction-rooted graph cycles, then replaces the Program snapshot and requires the missing-export diagnostic.
 *
 * @evidence contracts/e2e.md#shared-execution The existing Windows batch reuses its installed candidate SDK and one Go test artifact/process for all kernel cases. This entry creates only its conflicting fixture paths and junctions; graph evaluations reuse that fixture without an installation, native build, or product host per evaluation.
 *
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity newFileLinkFixture owns this entry's t.TempDir directory, JSON options, parsed sources, and file edits. The command producer returns after each junction is created, and Go testing cleans the fixture on success or failure. Distinct project roots prevent another case's files or mutable snapshot slice from supplying these assertions. This case distinguishes live Program value from stale disk bytes across repeated and junction-rooted graph cycles, then replaces the Program snapshot and requires the missing-export diagnostic.
 *
 * @evidence contracts/e2e.md#preserved-coverage TestWindowsFileLinksPreferProgramSnapshots keeps the original TestFileLinksPreferProgramSnapshots fixture inputs and every graph assertion, changing only the directory-link producer to the shared Windows junction operation. The original portable symbolic-link entry remains selectable in the Linux unit population. This case distinguishes live Program value from stale disk bytes across repeated and junction-rooted graph cycles, then replaces the Program snapshot and requires the missing-export diagnostic.
 */
func TestWindowsFileLinksPreferProgramSnapshots(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/value.ts": "export const stale = 1;", "review.md": "## Review\n<!-- @link api/value.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["*.ts"],"symbol":"property"}}]}`)
  fixture.sources = append(fixture.sources, fixture.source("api/value.ts", "export const value = 1;"))
  assertNoProblems(t, fixture.check())
  assertNoProblems(t, fixture.check())
  if err := linkWindowsPopulationDirectory(filepath.Join(fixture.root, "api"), filepath.Join(fixture.root, "linked")); err != nil {
    t.Fatal(err)
  }
  fixture.options = json.RawMessage(`{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"linked","files":["*.ts"],"symbol":"property"}}]}`)
  assertNoProblems(t, fixture.check())
  fixture.sources[0] = fixture.source("api/value.ts", "export const renamed = 2;")
  assertProblemContains(t, fixture.check(), "Missing TypeScript evidence export")
}
