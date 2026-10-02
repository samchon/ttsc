package linthost

import "testing"

// TestFixNoVarSkipsCrossScopeSameNameOverDecline verifies the deliberate
// conservative over-decline of the single-binding gate.
//
// In the function counterpart, x and g's parameter are independent bindings.
// The AST-local file-wide count nevertheless sees two binding positions and
// declines. That conservative policy costs a local fix without changing the
// program. The original script also has global-object exposure: replacing its
// top-level var would independently remove that property.
//
//  1. Parse a top-level `var x` plus an unrelated `function g(x) {}`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
//
// The original script is retained. A sloppy-function counterpart runs the
// same body so global-object binding exposure cannot mask this named guard.
//
// @evidence contracts/testing.md#behavioral-verification no-var deliberately declines top-level x when an unrelated function parameter also binds x.
// @evidence contracts/testing.md#independent-expectations The unchanged source and zero fixes pin the supported conservative file-wide name-count policy, without claiming the function-local rewrite is unsafe; the original script also preserves its global property.
// @evidence contracts/testing.md#distinguishing-cases Distinct scopes still over-decline under this AST-local policy; a truly unique name fixes in the companion positive case.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsCrossScopeSameNameOverDecline calls assertNoFixSnapshot for top-level x and g(x).
func TestFixNoVarSkipsCrossScopeSameNameOverDecline(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = 1;\nfunction g(x) {\n  return x;\n}\nJSON.stringify([x, g(2)]);\n",
  )
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\nvar x = 1;\nfunction g(x) {\n  return x;\n}\nJSON.stringify([x, g(2)]);\n}\n",
  )
}
