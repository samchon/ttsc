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
 * @evidence contracts/testing.md#execution-ownership TestWindowsFileLinksCheckSelectedModuleBoundaries is a Windows-only Go unit entry of package evidence, run by go test on a Windows host. It creates real NTFS directory junctions through linkWindowsPopulationDirectory and drives the rule in-process; it starts no ttsc check, lint sidecar or installed consumer.
 *
 *
 *
 *
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
