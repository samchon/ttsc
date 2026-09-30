package evidence

import (
  "testing"
)

/**
 * Verifies `evidence/documented` stops demanding a block on a withdrawn export.
 *
 * A `documented` obligation that survived the population would be the worst of
 * both: the declaration is not citable, not selectable, and still reported.
 * The untagged sibling proves the rule still fires.
 *
 *  1. Withdraw one undocumented export and leave another bare beside it.
 *  2. Run the documented rule over function hosts.
 *  3. Assert only the untagged export is reported.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises the authored fixture. Assert only the untagged export is reported.
 * @evidence contracts/testing.md#independent-expectations A `documented` obligation that survived the population would be the worst of both: the declaration is not citable, not selectable, and still reported. The untagged sibling proves the rule still fires. The authored scenario requires this outcome: Assert only the untagged export is reported.
 * @evidence contracts/testing.md#distinguishing-cases Withdraw one undocumented export and leave another bare beside it. Run the documented rule over function hosts. Assert only the untagged export is reported.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSkipsHiddenExports runs as a Go unit entry in the native package. runDocumentedRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestDocumentedSkipsHiddenExports(t *testing.T) {
  for _, tag := range hiddenTagCases {
    t.Run(tag, func(t *testing.T) {
      assertReported(t, runDocumentedRule(t, "src/health.ts", `
/** `+tag+` Internal plumbing. */
export function reset(): void {}

export function check(): void {}
`, `{"symbol":["function"]}`), "Missing JSDoc on exported function 'check'")
    })
  }
}
