package linthost

import "testing"

// TestFixNoVarSkipsFunctionScopeEscape verifies no-var declines the fix for a
// `var` declared inside a function body and referenced outside the function.
//
// The declaring statement's block scope is the function body Block, so a
// reference past the closing brace lies outside the scope span. The gate has
// no checker and cannot know what that outer identifier resolves to; keeping
// the report fix-free is the conservative side of the containment check.
//
//  1. Parse a function body declaring `var x` with a same-name read after the
//     function.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsFunctionScopeEscape(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "function f() {\n  var x = 1;\n}\nJSON.stringify([f, x]);\n",
  )
}
