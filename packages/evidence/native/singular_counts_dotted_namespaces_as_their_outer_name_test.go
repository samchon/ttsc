package evidence

import (
  "testing"
)

/**
 * Verifies a dotted namespace declaration counts as its outer name.
 *
 * `export namespace Outer.Inner {}` looks like one declaration with a dotted
 * name and is actually nested module declarations, which is the shape that
 * panics an `As*` accessor reached without a kind check. The outer name is the
 * identity; the inner one is a member of it.
 *
 *  1. Declare a dotted namespace.
 *  2. Run the rule against a file named after the outer segment.
 *  3. Assert silence, and that the inner segment is not demanded.
 *
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence, and that the inner segment is not demanded.
 * @evidence contracts/testing.md#independent-expectations `export namespace Outer.Inner {}` looks like one declaration with a dotted name and is actually nested module declarations, which is the shape that panics an `As*` accessor reached without a kind check. The outer name is the identity; the inner one is a member of it. The authored scenario requires this outcome: Assert silence, and that the inner segment is not demanded.
 * @evidence contracts/testing.md#distinguishing-cases Declare a dotted namespace. Run the rule against a file named after the outer segment. Assert silence, and that the inner segment is not demanded.
 * @evidence contracts/testing.md#execution-ownership TestSingularCountsDottedNamespacesAsTheirOuterName runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularCountsDottedNamespacesAsTheirOuterName(t *testing.T) {
  source := `
export namespace Outer.Inner {
  export const value: string = "1";
}
`
  assertSilent(t, runSingularRule(t, "src/Outer.ts", source))
  assertReported(
    t,
    runSingularRule(t, "src/Inner.ts", source),
    "'Inner.ts' declares 'Outer'",
  )
}
