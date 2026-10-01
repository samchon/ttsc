package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies linked project roots keep authored paths distinct from unit IDs.
 *
 * The same relative spelling can name different siblings of the authored and
 * physical project roots. Identity lookup must not substitute the wrong source.
 *
 * 1. Link a project beside a rooted API and supply a decoy Program sibling.
 * 2. Resolve the API's disk re-export, then prefer its actual editor snapshot.
 * 3. Remove its saved file and verify the unsaved source remains selectable.
 *
 * @evidence contracts/testing.md#behavioral-verification newFileLinkFixture builds a physical project and API plus a logical API whose index re-exports `value` and whose physical sibling exports a decoy, links the project through a symlink, supplies an editor snapshot `export const live = 3;` and runs graphRule.Check through the linked root; every stage (disk re-export, snapshot after rewriting index to export `live`, the saved file removed, and a files-only root over value.ts) must report no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the identity contract: the authored path under the linked project root names the logical sibling (exporting `value` or `live`) and not the physical decoy, and an unsaved editor snapshot stays selectable after its disk file is deleted.
 * @evidence contracts/testing.md#distinguishing-cases The decoy under the physical root exports a different name, so resolution through the wrong sibling would produce a missing-export diagnostic; clean results at four stages (disk, snapshot preferred, snapshot after deletion, direct file selection) distinguish the stages.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksKeepRootAliasPathsAndSnapshots is a Go unit entry in the native test process; it drives graphRule.Check through newFileLinkFixture over real temp files, a real directory symbolic link and in-memory source snapshots, with no consumer install or product host.
 */
func TestFileLinksKeepRootAliasPathsAndSnapshots(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{
    "physical/project/review.md": "## Review\n<!-- @link ../api/index.ts#value Reads the value. -->\n",
    "logical/api/index.ts":       "export { value } from './value';",
    "logical/api/value.ts":       "export const value = 1;",
    "physical/api/value.ts":      "export const decoy = 2;",
  }, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"../api","files":["index.ts"],"symbol":"property"}}]}`)
  workspace := fixture.root
  linked := filepath.Join(workspace, "logical/project")
  if err := linkDirectory(filepath.Join(workspace, "physical/project"), linked); err != nil {
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
