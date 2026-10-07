package linthost

import "testing"

// TestFormatArrowParensWrapsBareSingleParam verifies prefer:"always" (the
// default, matching Prettier) adds parentheses around a single bare-identifier
// arrow parameter.
//
//  1. Parse `x => x`.
//  2. Apply format/arrow-parens with prefer:"always".
//  3. Assert it becomes `(x) => x`.
//
// @evidence contracts/testing.md#behavioral-verification format/arrow-parens must change bare x to parenthesized x under always while preserving the const binding, arrow and returned identifier.
// @evidence contracts/testing.md#independent-expectations The independently authored full expected source expresses the always policy for a bare singleton; unchanged tokens retain the identity arrow meaning.
// @evidence contracts/testing.md#distinguishing-cases The changed bare singleton is the positive counterpart to already-wrapped idempotency and commented/typed/destructured guards. Exact output requires the intended change and retained payload.
// @evidence contracts/testing.md#execution-ownership TestFormatArrowParensWrapsBareSingleParam is selected by the lint semantic-unit Evidence claim as a public Go unit. The owning formatter rule runs through the shared syntax-only rule harness on temporary fixture source; this entry owns its assertions and any named subtests without consumer installation, native product build or host process.
func TestFormatArrowParensWrapsBareSingleParam(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/arrow-parens",
    "const a = x => x;\n",
    `{"prefer":"always"}`,
    "const a = (x) => x;\n",
  )
}
