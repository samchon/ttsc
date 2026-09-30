//go:build windows

package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies Windows junction traversal: linked project roots keep authored paths distinct from unit IDs.
 *
 * The same relative spelling can name different siblings of the authored and
 * physical project roots. Identity lookup must not substitute the wrong source.
 *
 * 1. Link a project beside a rooted API and supply a decoy Program sibling.
 * 2. Resolve the API's disk re-export, then prefer its actual editor snapshot.
 * 3. Remove its saved file and verify the unsaved source remains selectable.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies linked project roots keep authored paths distinct from unit IDs.
 *
 * @evidence contracts/testing.md#independent-expectations The authored logical API exports value/live, whereas the physical decoy exports decoy. Successful resolution before and after deletion proves selection follows the intended disk source and retained snapshot.
 *
 * @evidence contracts/testing.md#distinguishing-cases Link a project beside a rooted API and supply a decoy Program sibling. Resolve the API's disk re-export, then prefer its actual editor snapshot. Remove its saved file and verify the unsaved source remains selectable.
 *
 * @evidence contracts/testing.md#execution-ownership TestWindowsFileLinksKeepRootAliasPathsAndSnapshots is the Windows-only Go entry in the existing installed-SDK kernel batch. It calls the shared linkWindowsPopulationDirectory fixture producer and graphRule.Check in the batch native process; Markdown/TypeScript inputs do not activate Prisma or Swagger loaders.
 *
 * @evidence contracts/e2e.md#necessary-boundary The shared producer creates actual Windows directory junctions through cmd.exe and mklink /J. Root identity and module traversal consume the resulting reparse points; a portable symbolic-link fixture cannot establish this kernel connection. This case distinguishes authored and physical root siblings with a decoy Program source, then retains the logical API snapshot after deleting its saved file and selecting the unsaved entry.
 *
 * @evidence contracts/e2e.md#shared-execution The existing Windows batch reuses its installed candidate SDK and one Go test artifact/process for all kernel cases. This entry creates only its conflicting fixture paths and junctions; graph evaluations reuse that fixture without an installation, native build, or product host per evaluation.
 *
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity newFileLinkFixture owns this entry's t.TempDir directory, JSON options, parsed sources, and file edits. The command producer returns after each junction is created, and Go testing cleans the fixture on success or failure. Distinct project roots prevent another case's files or mutable snapshot slice from supplying these assertions. This case distinguishes authored and physical root siblings with a decoy Program source, then retains the logical API snapshot after deleting its saved file and selecting the unsaved entry.
 *
 * @evidence contracts/e2e.md#preserved-coverage TestWindowsFileLinksKeepRootAliasPathsAndSnapshots keeps the original TestFileLinksKeepRootAliasPathsAndSnapshots fixture inputs and every graph assertion, changing only the directory-link producer to the shared Windows junction operation. The original portable symbolic-link entry remains selectable in the Linux unit population. This case distinguishes authored and physical root siblings with a decoy Program source, then retains the logical API snapshot after deleting its saved file and selecting the unsaved entry.
 */
func TestWindowsFileLinksKeepRootAliasPathsAndSnapshots(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{
    "physical/project/review.md": "## Review\n<!-- @link ../api/index.ts#value Reads the value. -->\n",
    "logical/api/index.ts":       "export { value } from './value';",
    "logical/api/value.ts":       "export const value = 1;",
    "physical/api/value.ts":      "export const decoy = 2;",
  }, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"../api","files":["index.ts"],"symbol":"property"}}]}`)
  workspace := fixture.root
  linked := filepath.Join(workspace, "logical/project")
  if err := linkWindowsPopulationDirectory(filepath.Join(workspace, "physical/project"), linked); err != nil {
    t.Fatal(err)
  }
  fixture.sources = append(fixture.sources, fixture.source("physical/api/value.ts", "export const decoy = 2;"))
  snapshot := fixture.source("logical/api/value.ts", "export const live = 3;")
  fixture.root = linked
  assertNoProblems(t, fixture.check())
  fixture.sources = append(fixture.sources, snapshot)
  fixture.write("../api/index.ts", "export { live } from './value';")
  fixture.write("review.md", "## Review\n<!-- @link ../api/index.ts#live Reads the live value. -->\n")
  assertNoProblems(t, fixture.check())
  if err := os.Remove(filepath.Join(workspace, "logical/api/value.ts")); err != nil {
    t.Fatal(err)
  }
  assertNoProblems(t, fixture.check())
  fixture.options = json.RawMessage(`{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"../api","files":["value.ts"],"symbol":"property"}}]}`)
  fixture.write("review.md", "## Review\n<!-- @link ../api/value.ts#live Reads the unsaved entry. -->\n")
  assertNoProblems(t, fixture.check())
}
