package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the negative twin: an ordinary namespace keeps every member
 * selected.
 *
 * The correction is keyed on the merge, not on nesting. Without this case a
 * rule that dropped every namespace member would pass the accessor cases just
 * as well, and would silently erase the obligations of every grouped export in
 * a consumer's codebase.
 *
 *  1. Group independent callables under a namespace nothing merges with.
 *  2. Cite the namespace's own name.
 *  3. Assert the members are still owed under their qualified addresses.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over test/** and a function reference over src/index.ts, where `namespace health` (merged with nothing) holds two arrow-function consts and the test cites only `{@link api.health.check}`; the diagnostics must contain `Missing acknowledgement for 'health.probe'` and exactly one `Missing acknowledgement` in total.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the merge-keyed contract: only a namespace merged with a function loses its members, so an ordinary namespace's members stay selected and the uncited member stays owed under its qualified address.
 * @evidence contracts/testing.md#distinguishing-cases One cited and one uncited member of an ordinary namespace; the exact count of one fails if the members were dropped (none) or if the cited one were also owed (two).
 * @evidence contracts/testing.md#execution-ownership TestGraphKeepsOrdinaryNamespaceMembersSelected is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphKeepsOrdinaryNamespaceMembersSelected(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/health.ts": `
export namespace health {
  export const check = (): void => {};
  export const probe = (): void => {};
}
`,
    "src/index.ts": "export * from \"./api/health\";\n",
    "test/health.ts": `import type * as api from "../src/index";

/** @evidence {@link api.health.check} Exercises the check helper. */
export function test_health(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["test/**"],
    "symbol":"function",
    "reference":{"type":"typescript","files":["src/index.ts"],"symbol":["function"]}
  }]}`)
  assertProblemContains(t, messages, "Missing acknowledgement for 'health.probe'")
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 1 {
    t.Fatalf(
      "expected only the uncited member to remain owed, got %d:\n%s",
      count,
      strings.Join(messages, "\n"),
    )
  }
}
