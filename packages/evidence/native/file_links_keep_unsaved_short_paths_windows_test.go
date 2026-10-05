package evidence

import (
  "golang.org/x/sys/windows"
  "os"
  "path/filepath"
  "strings"
  "testing"
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
 * @evidence contracts/testing.md#execution-ownership TestFileLinksKeepUnsavedShortPaths is a Windows-only Go unit entry of package evidence, run by go test on a Windows host. It creates real NTFS directory junctions through linkWindowsPopulationDirectory and drives the rule in-process; it starts no ttsc check, lint sidecar or installed consumer.
 *
 *
 *
 *
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
