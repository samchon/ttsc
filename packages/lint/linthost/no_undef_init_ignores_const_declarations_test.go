package linthost

import "testing"

// TestNoUndefInitIgnoresConstDeclarations verifies that no-undef-init reports
// `let` and `var` declarations initialized to undefined and not `const`.
//
// An ordinary `const` declaration requires an initializer, so the authored const
// case retains its explicit undefined value. The authored fresh `let` and `var`
// bindings can omit that initializer and initialize to undefined.
//
//  1. Run the rule over `let x = undefined;` and `var y = undefined;` and assert
//     each reports once.
//  2. Run it over `const z = undefined;` and over `let w = 1;` and assert nothing
//     is reported.
//
// @evidence contracts/testing.md#behavioral-verification no-undef-init must report let and var declarations initialized to undefined and must leave a const declaration and a non-undefined initializer alone.
// @evidence contracts/testing.md#independent-expectations Ordinary const requires an initializer; the authored fresh let and var bindings initialize to undefined when that initializer is omitted. Literal source/count expectations own this policy, without assuming let is initialized before its declaration.
// @evidence contracts/testing.md#distinguishing-cases The authored const/let and undefined/non-undefined sources distinguish declaration kind and initializer value, with matching name references; independent count expectations detect either policy mistake.
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
