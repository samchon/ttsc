package linthost

import "testing"

// TestFixNoVarSkipsCatchBindingRedeclaration verifies no-var reports but does
// not rewrite a `var` that shares its name with an enclosing catch binding.
//
// `try {} catch (e) { var e = 1; }` is legal under `var` hoisting, but
// rewriting the keyword to `let e` collides with the catch parameter `e` and
// raises a duplicate-declaration SyntaxError. The single-binding-in-file gate
// counts `e` twice (catch clause + var), so the fix is declined while the
// diagnostic still fires.
//
//  1. Parse `try {} catch (e) { var e = 1; }`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsCatchBindingRedeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "try {\n} catch (e) {\n  var e = 1;\n  JSON.stringify(e);\n}\n",
  )
}
