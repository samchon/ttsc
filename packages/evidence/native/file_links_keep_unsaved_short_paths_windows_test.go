package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
  "golang.org/x/sys/windows"
)

/**
 * Verifies Windows 8.3 project roots retain snapshots after path deletion.
 *
 * EvalSymlinks cannot expand a missing file's short-named ancestors. Identity
 * must still agree with the rooted population while the editor owns its source.
 *
 * 1. Select a barrel and its snapshot through an actual DOS project-root alias.
 * 2. Delete the saved target and its parent while retaining the snapshot.
 * 3. Resolve a new snapshot whose nested directories were never saved.
 * 4. Replace that snapshot and require the missing exported name diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies Windows 8.3 project roots retain snapshots after path deletion.
 *
 * @evidence contracts/testing.md#independent-expectations The retained snapshot exports value through a real distinct DOS alias even after file and parent deletion; replacing it with renamed must yield the literal missing value export diagnostic.
 *
 * @evidence contracts/testing.md#distinguishing-cases Select a barrel and its snapshot through an actual DOS project-root alias. Delete the saved target and its parent while retaining the snapshot. Resolve a new snapshot whose nested directories were never saved. Replace that snapshot and require the missing exported name diagnostic.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksKeepUnsavedShortPaths, discoverable only through its Windows filename, belongs to the existing Windows boundary batch. It calls GetShortPathName on its own fixture and invokes graphRule.Check against the returned DOS alias; it neither installs a consumer nor builds or starts another native host.
 *
 * @evidence contracts/e2e.md#necessary-boundary GetShortPathName supplies the actual Windows DOS alias consumed by rooted source identity; portable path-parser calls cannot establish that alias remains usable after the saved target and parent disappear.
 *
 * @evidence contracts/e2e.md#shared-execution This case consumes the existing Windows runner and native test artifact once. Its successive graph calls reuse one fixture and retained snapshot; only source bytes and deleted paths change, so no per-step installation or producer is needed.
 *
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The test owns a t.TempDir project and its snapshot slice. It first supplies value, removes the file and parent, then supplies a never-saved nested value and finally renamed. Go testing cleans the directory on success and failure; no warm snapshot is substituted for the required replacement.
 *
 * @evidence contracts/e2e.md#preserved-coverage This entry retains every clean check across saved/deleted/never-saved states and the final missing-value diagnostic. The distinct DOS alias is a required fixture precondition; an unavailable alias must fail rather than silently count as successful coverage.
 */
func TestFileLinksKeepUnsavedShortPaths(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{
    "review.md":           "## Review\n<!-- @link api/index.ts#value Reads the value. -->\n",
    "api/index.ts":        "export { value } from './nested/value';",
    "api/nested/value.ts": "export const value = 1;",
  }, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
  input, err := windows.UTF16PtrFromString(fixture.root)
  if err != nil {
    t.Fatal(err)
  }
  needed, err := windows.GetShortPathName(input, nil, 0)
  if err != nil || needed == 0 {
    t.Fatalf("Windows boundary fixture requires short paths: %v", err)
  }
  buffer := make([]uint16, needed)
  written, err := windows.GetShortPathName(input, &buffer[0], uint32(len(buffer)))
  if err != nil || written >= uint32(len(buffer)) {
    t.Fatalf("could not read the short path: length=%d, error=%v", written, err)
  }
  short := windows.UTF16ToString(buffer[:written])
  if strings.EqualFold(filepath.Clean(short), filepath.Clean(fixture.root)) {
    t.Fatal("Windows boundary fixture requires a distinct 8.3 alias")
  }
  fixture.root = short
  fixture.sources = append(fixture.sources, fixture.source("api/nested/value.ts", "export const value = 1;"))
  assertNoProblems(t, fixture.check())
  if err := os.Remove(filepath.Join(short, "api/nested/value.ts")); err != nil {
    t.Fatal(err)
  }
  assertNoProblems(t, fixture.check())
  if err := os.Remove(filepath.Join(short, "api/nested")); err != nil {
    t.Fatal(err)
  }
  assertNoProblems(t, fixture.check())
  fixture.sources[0] = fixture.source("api/future/child/value.ts", "export const value = 2;")
  fixture.write("api/index.ts", "export { value } from './future/child/value';")
  assertNoProblems(t, fixture.check())
  fixture.sources[0] = fixture.source("api/future/child/value.ts", "export const renamed = 3;")
  assertProblemContains(t, fixture.check(), "no public export named 'value'")
}
