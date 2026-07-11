package linthost

import "testing"

// TestFixNoVarReplacesReferenceInsideWithBody verifies no-var still rewrites
// a `var` declared outside a `with` statement but referenced inside its body.
//
// Negative twin of the with-body decline: the hazard is where the DECLARATION
// lands, not where references sit. For a binding declared outside the with,
// the with object shadows `var` and `let` identically on the body's scope
// chain, so the rewrite cannot change which binding a reference resolves to.
//
//  1. Parse a top-level `var x` read from inside a with body.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarReplacesReferenceInsideWithBody(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "const o = {};\nvar x = 1;\nwith (o) {\n  JSON.stringify(x);\n}\n",
    "const o = {};\nlet x = 1;\nwith (o) {\n  JSON.stringify(x);\n}\n",
  )
}
