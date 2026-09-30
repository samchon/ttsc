package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies root containment judges the selected module, not an extensionless path.
 *
 * A same-named directory can exist beside value.ts and is not its identity.
 * Resolving a directory link before module substitution rejects a valid file.
 *
 * 1. Re-export value.ts beside a value/ directory linked outside the root.
 * 2. Verify the file wins and its citation succeeds.
 * 3. Remove that candidate and verify a directory entry outside the root fails.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies root containment judges the selected module, not an extensionless path.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The .ts file wins before its adjacent linked directory; deleting that file makes the re-export leave the explicitly selected root and must report that reason.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Re-export value.ts beside a value/ directory linked outside the root. Verify the file wins and its citation succeeds. Remove that candidate and verify a directory entry outside the root fails.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFileLinksCheckSelectedModuleBoundaries is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the file-link fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes. Its linked-directory fixture invokes the shared symbolic-link operation on real fixture paths. The separate Windows boundary cases own junction production; this entry does not substitute a process-backed producer when symbolic-link privileges are missing.
 */
func TestFileLinksCheckSelectedModuleBoundaries(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/index.ts": "export { value } from './value';", "api/value.ts": "export const value = 1;", "outside/index.ts": "export const value = 2;", "review.md": "## Review\n<!-- @link api/index.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
  if err := linkDirectory(filepath.Join(fixture.root, "outside"), filepath.Join(fixture.root, "api/value")); err != nil {
    t.Fatal(err)
  }
  assertNoProblems(t, fixture.check())
  if err := os.Remove(filepath.Join(fixture.root, "api/value.ts")); err != nil {
    t.Fatal(err)
  }
  assertProblemContains(t, fixture.check(), "re-export leaves the explicitly configured root")
}
