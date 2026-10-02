package evidence

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

/**
 * Verifies an active Program snapshot wins over stale disk content in a root.
 *
 * An editor's parsed source can differ from disk, and cache reuse must follow
 * that source rather than keep either an old parse or the latest saved bytes.
 *
 * 1. Supply a Program export that differs from the file on disk.
 * 2. Verify repeated graph cycles use that snapshot.
 * 3. Replace the Program source and assert the citation becomes unresolved.
 *
 * @evidence contracts/testing.md#behavioral-verification newFileLinkFixture writes api/value.ts as `export const stale = 1;` but supplies the Program source `export const value = 1;`; graphRule.Check must be clean twice, clean again through a `linked` root (a directory symlink to api), and after the Program source is replaced by `export const renamed = 2;` must report `Missing TypeScript evidence export`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the snapshot contract: the editor's parsed source wins over the saved bytes and over any cached older parse, so `value` resolves while the disk says `stale`, and the replacement snapshot makes the link unresolved.
 * @evidence contracts/testing.md#distinguishing-cases Repeated cycles guard cache reuse, the linked root guards alias resolution, and the final replacement proves the snapshot (not disk, which still says `stale`) drives the result.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPreferProgramSnapshots is a Go unit entry in the native test process; it drives graphRule.Check through newFileLinkFixture over real temp files, a real directory symbolic link and in-memory source snapshots, with no consumer install or product host, and fails (not skips) if the link cannot be created.
 */
func TestFileLinksPreferProgramSnapshots(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/value.ts": "export const stale = 1;", "review.md": "## Review\n<!-- @link api/value.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["*.ts"],"symbol":"property"}}]}`)
  fixture.sources = append(fixture.sources, fixture.source("api/value.ts", "export const value = 1;"))
  assertNoProblems(t, fixture.check())
  assertNoProblems(t, fixture.check())
  if err := linkDirectory(t, filepath.Join(fixture.root, "api"), filepath.Join(fixture.root, "linked")); err != nil {
    t.Fatal(err)
  }
  fixture.options = json.RawMessage(`{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"linked","files":["*.ts"],"symbol":"property"}}]}`)
  assertNoProblems(t, fixture.check())
  fixture.sources[0] = fixture.source("api/value.ts", "export const renamed = 2;")
  assertProblemContains(t, fixture.check(), "Missing TypeScript evidence export")
}
