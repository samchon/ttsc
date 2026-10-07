package linthost

import "testing"

// TestFixNoVarSkipsLetAsBindingName verifies no-var declines the fix for a
// binding literally named `let`.
//
// `var let = 1;` parses in sloppy scripts, but `let let = 1;` is a
// SyntaxError in every mode, so the keyword rewrite would corrupt the source
// outright. The output must retain valid binding grammar; upstream ESLint's
// hasNameDisallowedForLetDeclarations also refuses a binding named let.
//
//  1. Parse a file declaring `var let = 1` and reading it afterwards.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
//
// @evidence contracts/testing.md#behavioral-verification no-var diagnoses var let but cannot rewrite it to the invalid lexical spelling let let.
// @evidence contracts/testing.md#independent-expectations The independently authored original binding and zero applied edits preserve parser grammar.
// @evidence contracts/testing.md#distinguishing-cases The disallowed name differs from ordinary unique x/legacy names; a sloppy-function counterpart removes the independent script-global refusal.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsLetAsBindingName uses assertNoFixSnapshot with both the original script and sloppy-function let binding.
func TestFixNoVarSkipsLetAsBindingName(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var let = 1;\nJSON.stringify(let);\n",
  )
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\nvar let = 1;\nJSON.stringify(let);\n}\n",
  )
}
