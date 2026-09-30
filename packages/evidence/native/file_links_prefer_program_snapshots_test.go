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
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies an active Program snapshot wins over stale disk content in a root.
 *
 * @evidence contracts/testing.md#independent-expectations The Program exports value while disk exports stale, then the replacement snapshot exports renamed. Clean repeated and linked-root checks followed by missing-export failure distinguish snapshot precedence.
 *
 * @evidence contracts/testing.md#distinguishing-cases Supply a Program export that differs from the file on disk. Verify repeated graph cycles use that snapshot. Replace the Program source and assert the citation becomes unresolved.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPreferProgramSnapshots is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the file-link fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes. Its linked-directory fixture invokes the shared symbolic-link operation on real fixture paths. The separate Windows boundary cases own junction production; this entry does not substitute a process-backed producer when symbolic-link privileges are missing.
 */
func TestFileLinksPreferProgramSnapshots(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/value.ts": "export const stale = 1;", "review.md": "## Review\n<!-- @link api/value.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["*.ts"],"symbol":"property"}}]}`)
  fixture.sources = append(fixture.sources, fixture.source("api/value.ts", "export const value = 1;"))
  assertNoProblems(t, fixture.check())
  assertNoProblems(t, fixture.check())
  if err := linkDirectory(filepath.Join(fixture.root, "api"), filepath.Join(fixture.root, "linked")); err != nil {
    t.Fatal(err)
  }
  fixture.options = json.RawMessage(`{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"linked","files":["*.ts"],"symbol":"property"}}]}`)
  assertNoProblems(t, fixture.check())
  fixture.sources[0] = fixture.source("api/value.ts", "export const renamed = 2;")
  assertProblemContains(t, fixture.check(), "Missing TypeScript evidence export")
}
