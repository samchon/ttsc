package linthost

import "testing"

// TestRuleCorpusUnicornPreferGlobalThis verifies unicorn/prefer-global-this
// reports a bare `window` reference in value position.
//
// The rule's value-position gate is the most error-prone piece — a naive
// identifier visitor would also fire on `obj.window`, parameter names, and
// type references. A `void window;` statement is the minimal shape that
// passes the gate, pinning the canonical positive case.
//
// 1. Enable unicorn/prefer-global-this via an expect annotation.
// 2. Read the bare `window` identifier as a value expression.
// 3. Assert the identifier is reported.
func TestRuleCorpusUnicornPreferGlobalThis(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-global-this.ts", "// expect: unicorn/prefer-global-this error\nvoid window;\n")
}
