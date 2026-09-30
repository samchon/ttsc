package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies linked roots preserve identity while nested escapes remain forbidden.
 *
 * An explicitly linked root is a selected directory. A nested link cannot
 * silently add an unconfigured implementation or duplicate an existing unit.
 *
 * 1. Select one physical module through its directory and an explicit root link.
 * 2. Assert a single citation acknowledges both populations.
 * 3. Add a nested link outside the root and verify traversal fails.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies linked roots preserve identity while nested escapes remain forbidden.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Two explicit roots reaching one physical value owe one obligation; a nested escape to the different outside value must report the rooted traversal restriction.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select one physical module through its directory and an explicit root link. Assert a single citation acknowledges both populations. Add a nested link outside the root and verify traversal fails.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFileLinksKeepPhysicalRootBoundaries is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the file-link fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes. Its linked-directory fixture invokes the shared symbolic-link operation on real fixture paths. The separate Windows boundary cases own junction production; this entry does not substitute a process-backed producer when symbolic-link privileges are missing.
 */
func TestFileLinksKeepPhysicalRootBoundaries(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/value.ts": "export const value = 1;", "outside/value.ts": "export const value = 2;", "review.md": "## Review\n<!-- @link api/value.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":[{"type":"typescript","root":"api","files":["value.ts"],"symbol":"property"},{"type":"typescript","root":"linked","files":["value.ts"],"symbol":"property"}]}]}`)
  if err := linkDirectory(filepath.Join(fixture.root, "api"), filepath.Join(fixture.root, "linked")); err != nil {
    t.Fatal(err)
  }
  assertNoProblems(t, fixture.check())
  if err := linkDirectory(filepath.Join(fixture.root, "outside"), filepath.Join(fixture.root, "api/escape")); err != nil {
    t.Fatal(err)
  }
  fixture.write("api/value.ts", "export { value } from './escape/value';")
  assertProblemContains(t, fixture.check(), "re-export leaves the explicitly configured root")
}
