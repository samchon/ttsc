package main

import "testing"

// TestRuleNoInferrableTypesUnaryNumeric verifies unary numeric initializers.
//
// The generated corpus covers ordinary literal inference. This handwritten case
// covers the prefix-unary helper used for number annotations initialized with
// negative or positive numeric literals.
//
// This scenario keeps isUnaryNumeric covered without widening the TypeScript
// feature fixture expected-output surface.
//
// 1. Build a TypeScript fixture with an inferrable negative number.
// 2. Enable no-inferrable-types through the corpus helper.
// 3. Assert the native Engine reports the annotated diagnostic.
func TestRuleNoInferrableTypesUnaryNumeric(t *testing.T) {
	assertRuleCorpusCase(t, "no-inferrable-types-unary-numeric.ts", `// expect: no-inferrable-types error
const value: number = -1;
JSON.stringify(value);
`)
}
