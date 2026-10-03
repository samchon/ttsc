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
 *
 * @evidence contracts/testing.md#behavioral-verification For each of the hidden tags `@internal`, `@hidden` and `@ignore` (hiddenTagCases) a t.Run subtest runs the documented rule with `{"symbol":["function"]}` over a hidden-tagged `export function reset` beside an undocumented `export function check`; assertReported requires exactly one diagnostic, `Missing JSDoc on exported function 'check'`.
 * @evidence contracts/testing.md#independent-expectations The expected single report is authored from the population contract: a withdrawn declaration is neither citable nor selectable, so the rule must not demand a block on it, while its undocumented sibling is still demanded.
 * @evidence contracts/testing.md#distinguishing-cases Each of the three hidden-tag spellings is its own subtest; the untagged sibling `check` is the control that shows the rule still fires, and the exactly-one assertion fails if `reset` is also reported.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSkipsHiddenExports is a Go unit entry in the native test process that owns three t.Run subtests over hiddenTagCases; runDocumentedRule parses each source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
