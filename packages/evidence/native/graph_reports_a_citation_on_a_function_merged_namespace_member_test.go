package evidence

import (
  "testing"
)

/**
 * Verifies a citation left on a static member is reported rather than ignored.
 *
 * A declaration that stops being a public unit also stops being able to host a
 * tag, and an author who already wrote one there has to be told. Dropping the
 * tag silently would leave the claim's obligation quietly uncovered, which is
 * the exact substitution this product refuses , so both halves are asserted:
 * the host is named as out of scope, and the target it meant to cover is still
 * owed.
 *
 *  1. Put an `@evidence` tag on a member of a function-merged namespace.
 *  2. Evaluate a claim selecting function hosts.
 *  3. Assert the ineligible host is named and the obligation stays open.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the ineligible host is named and the obligation stays open.
 * @evidence contracts/testing.md#independent-expectations A declaration that stops being a public unit also stops being able to host a tag, and an author who already wrote one there has to be told. Dropping the tag silently would leave the claim's obligation quietly uncovered, which is the exact substitution this product refuses , so both halves are asserted: the host is named as out of scope, and the target it meant to cover is still owed. The authored scenario requires this outcome: Assert the ineligible host is named and the obligation stays open.
 * @evidence contracts/testing.md#distinguishing-cases Put an `@evidence` tag on a member of a function-merged namespace. Evaluate a claim selecting function hosts. Assert the ineligible host is named and the obligation stays open.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsACitationOnAFunctionMergedNamespaceMember runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestGraphReportsACitationOnAFunctionMergedNamespaceMember(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/api/health.ts": `
export function get(): void {}
export namespace get {
  /** @evidence docs/spec.md#contract The static member claims this. */
  export const path = () => "/health";
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/api/health.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "host kind 'unsupported or non-exported declaration' is not selected",
  )
  assertProblemContains(
    t,
    messages,
    "Missing acknowledgement for 'docs/spec.md#contract'",
  )
}
