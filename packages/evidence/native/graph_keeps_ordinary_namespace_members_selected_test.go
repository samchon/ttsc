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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the members are still owed under their qualified addresses.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The correction is keyed on the merge, not on nesting. Without this case a rule that dropped every namespace member would pass the accessor cases just as well, and would silently erase the obligations of every grouped export in a consumer's codebase. The authored scenario requires this outcome: Assert the members are still owed under their qualified addresses.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Group independent callables under a namespace nothing merges with. Cite the namespace's own name. Assert the members are still owed under their qualified addresses.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphKeepsOrdinaryNamespaceMembersSelected runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
