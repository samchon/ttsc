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
//
// @evidence contracts/testing.md#behavioral-verification no-var reports catch-local var e without rewriting it into a lexical collision with the catch parameter.
// @evidence contracts/testing.md#independent-expectations Original source identity and zero applied edits independently preserve the legal catch/var spelling.
// @evidence contracts/testing.md#distinguishing-cases Two same-named binding positions decline; the unique-binding positive arm fixes normally.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsCatchBindingRedeclaration calls assertNoFixSnapshot on the catch-e fixture with the real rule.
func TestFixNoVarSkipsCatchBindingRedeclaration(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "try {\n} catch (e) {\n  var e = 1;\n  JSON.stringify(e);\n}\n",
  )
}
