package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a citation of a withdrawn target names the tag as the cause.
 *
 * This is the decision the issue asked to be made explicit. The target does
 * resolve to a real declaration, so a bare unresolved-target message would send
 * the author hunting for a typo that is not there. Both repairs are named,
 * because which one is right depends on which statement is wrong , the tag or
 * the citation.
 *
 *  1. Withdraw a callable and cite it from a claim host anyway.
 *  2. Evaluate the graph.
 *  3. Assert the diagnostic names the tag, the withdrawn declaration, and both
 *     repairs.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the diagnostic names the tag, the withdrawn declaration, and both repairs.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is the decision the issue asked to be made explicit. The target does resolve to a real declaration, so a bare unresolved-target message would send the author hunting for a typo that is not there. Both repairs are named, because which one is right depends on which statement is wrong , the tag or the citation. The authored scenario requires this outcome: Assert the diagnostic names the tag, the withdrawn declaration, and both repairs.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Withdraw a callable and cite it from a claim host anyway. Evaluate the graph. Assert the diagnostic names the tag, the withdrawn declaration, and both repairs.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphNamesTheTagWhenACitationTargetsAHiddenDeclaration runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestGraphNamesTheTagWhenACitationTargetsAHiddenDeclaration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/health.ts": `
/** @internal Internal plumbing. */
export function reset(): void {}

export function check(): void {}
`,
    "src/index.ts": "export * from \"./api/health\";\n",
    "test/health.ts": `import type * as api from "../src/index";

/**
 * @evidence {@link api.reset} Exercises the reset path.
 * @evidence {@link api.check} Exercises the check path.
 */
export function test_health(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["test/**"],
    "symbol":"function",
    "reference":{"type":"typescript","files":["src/index.ts"],"symbol":["function"]}
  }]}`)
  assertProblemContains(t, messages, "Hidden evidence target '{@link api.reset}'")
  assertProblemContains(t, messages, "carries '@internal' in its documentation comment")
  assertProblemContains(t, messages, "Remove the tag if the declaration is public contract")
  if count := countProblemsContaining(messages, "Hidden evidence target"); count != 1 {
    t.Fatalf(
      "expected one hidden-target diagnostic, got %d:\n%s",
      count,
      strings.Join(messages, "\n"),
    )
  }
}
