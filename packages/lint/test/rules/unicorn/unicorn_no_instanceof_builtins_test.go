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
func TestRuleCorpusUnicornNoInstanceofBuiltins(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-instanceof-builtins.ts", "declare const x: unknown;\n// expect: unicorn/no-instanceof-builtins error\nif (x instanceof Array) { void x; }\n")
}
