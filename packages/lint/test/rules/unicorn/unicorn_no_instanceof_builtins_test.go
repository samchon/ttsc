package linthost

import "testing"

// TestRuleCorpusUnicornNoInstanceofBuiltins verifies
// unicorn/no-instanceof-builtins reports `x instanceof Array`.
//
// The rule matches a BinaryExpression with an `instanceof` operator whose
// right-hand operand is an identifier in the built-in allowlist. Array is the
// most common offender — `instanceof Array` breaks across realms even though
// `Array.isArray` would work correctly — so this fixture pins the canonical
// case.
//
// 1. Enable unicorn/no-instanceof-builtins via an expect annotation.
// 2. Test `x instanceof Array` against a declared variable.
// 3. Assert the binary expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies instanceof Array misclassifies arrays across realms; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-instanceof-builtins annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Array.isArray supplies the supported builtin-array predicate. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoInstanceofBuiltins is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoInstanceofBuiltins(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-instanceof-builtins.ts", "declare const x: unknown;\n// expect: unicorn/no-instanceof-builtins error\nif (x instanceof Array) { void x; }\n")
  assertRuleSkipsSource(t, "unicorn/no-instanceof-builtins", "declare const x: unknown; if (Array.isArray(x)) { void x; }\n")
}
