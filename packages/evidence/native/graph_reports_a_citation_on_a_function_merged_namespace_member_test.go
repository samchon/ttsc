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
 * the exact substitution this product refuses, so both halves are asserted:
 * the host is named as out of scope, and the target it meant to cover is still
 * owed.
 *
 *  1. Put an `@evidence` tag on a member of a function-merged namespace.
 *  2. Evaluate a claim selecting function hosts.
 *  3. Assert the ineligible host is named and the obligation stays open.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/api/health.ts, where `namespace get` merged with `function get` has a member `path` carrying `@evidence docs/spec.md#contract`; the diagnostics must contain `host kind 'unsupported or non-exported declaration' is not selected` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the unit-model contract: a function-merged namespace member is the function's static side and no longer a public unit, so a tag already written there must be reported and the target it meant to cover stays owed rather than being dropped silently.
 * @evidence contracts/testing.md#distinguishing-cases The citation sits on the static member while the function `get` remains the selected host; both halves (host named out of scope, obligation still open) are asserted by containment.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsACitationOnAFunctionMergedNamespaceMember is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
