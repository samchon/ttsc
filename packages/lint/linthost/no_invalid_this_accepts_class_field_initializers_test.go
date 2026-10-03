package linthost

import "testing"

// TestNoInvalidThisAcceptsClassFieldInitializers verifies that `this` inside a
// class field initializer is a valid binding site, while top-level `this` is not.
//
// A field initializer runs with `this` bound to the new instance (or to the
// class for a static field), so reading it there is the normal way to derive one
// field from another, including through an arrow function.
//
//  1. Run the rule over direct instance/static field reads and an instance-field
//     arrow reading `this`, and assert nothing is reported.
//  2. Run it over a top-level arrow reading `this` and assert one finding.
//
// @evidence contracts/testing.md#behavioral-verification no-invalid-this accepts direct instance/static field reads and an instance-field arrow, while reporting the authored top-level arrow.
// @evidence contracts/testing.md#independent-expectations Class field initialization supplies the instance or class receiver. The rule's accepted binding sites include field declarations; the authored top-level arrow has none of these ancestors. This asserts the rule policy, not module identity or script-global this semantics.
// @evidence contracts/testing.md#distinguishing-cases The accepted field sources contrast with the top-level arrow, which differs only in not being inside a class, so accepting every arrow or reporting every field read fails one side.
// @evidence contracts/testing.md#execution-ownership TestNoInvalidThisAcceptsClassFieldInitializers parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestNoInvalidThisAcceptsClassFieldInitializers(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-invalid-this",
    "class A {\n  base = 1;\n  derived = this.base + 1;\n  read = () => this.base;\n  static kind = 'a';\n  static label = this.kind;\n}\nJSON.stringify(A);\n",
  )
  assertRuleFindingRanges(
    t,
    "no-invalid-this",
    "const top = () => this;\nJSON.stringify(top);\n",
    "this",
  )
}
