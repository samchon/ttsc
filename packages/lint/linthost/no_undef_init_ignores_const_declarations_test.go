package linthost

import "testing"

// TestNoUndefInitIgnoresConstDeclarations verifies that no-undef-init reports
// `let` and `var` declarations initialized to undefined and not `const`.
//
// A `const` declaration must have an initializer, so writing `undefined` there is
// the only way to declare an undefined constant. For `let` and `var` the
// initializer is redundant, because the binding starts as undefined anyway.
//
//  1. Run the rule over `let x = undefined;` and `var y = undefined;` and assert
//     each reports once.
//  2. Run it over `const z = undefined;` and over `let w = 1;` and assert nothing
//     is reported.
//
// @evidence contracts/testing.md#behavioral-verification no-undef-init must report let and var declarations initialized to undefined and must leave a const declaration and a non-undefined initializer alone.
// @evidence contracts/testing.md#independent-expectations ECMAScript requires const to be initialized and gives let and var the value undefined before assignment, which makes the initializer redundant only for the latter two; the literal sources are the oracle.
// @evidence contracts/testing.md#distinguishing-cases The const source differs from the let source only in the keyword, and the non-undefined initializer differs only in the value, so a rule that ignored the keyword or the value fails one side.
// @evidence contracts/testing.md#execution-ownership TestNoUndefInitIgnoresConstDeclarations parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestNoUndefInitIgnoresConstDeclarations(t *testing.T) {
  for _, source := range []string{
    "let x = undefined;\nJSON.stringify(x);\n",
    "var y = undefined;\nJSON.stringify(y);\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, "no-undef-init", source, nil)
    if len(findings) != 1 {
      t.Fatalf("no-undef-init on %q: want exactly one finding, got %d", source, len(findings))
    }
  }
  assertRuleSkipsSource(t, "no-undef-init", "const z = undefined;\nJSON.stringify(z);\n")
  assertRuleSkipsSource(t, "no-undef-init", "let w = 1;\nJSON.stringify(w);\n")
}
