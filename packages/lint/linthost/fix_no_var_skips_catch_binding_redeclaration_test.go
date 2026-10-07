package linthost

import "testing"

// TestFixNoVarSkipsCatchBindingRedeclaration verifies no-var reports but does
// not rewrite a `var` that shares its name with an enclosing catch binding.
//
// `try {} catch (e) { var e = 1; }` is legal under `var` hoisting, but
// rewriting the keyword to `let e` collides with the catch parameter `e` and
// raises a duplicate-declaration SyntaxError. The binding census sees the
// catch binding as well as the var declaration, so its count cannot be one
// and the fix is declined while the diagnostic still fires.
//
//  1. Parse `try {} catch (e) { var e = 1; }`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
//
// The original script is retained. A sloppy-function counterpart runs the
// same body so global-object binding exposure cannot mask this named guard.
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
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\ntry {\n} catch (e) {\n  var e = 1;\n  JSON.stringify(e);\n}\n}\n",
  )
}
