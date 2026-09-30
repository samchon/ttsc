package linthost

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
// 2. Enable noInferrableTypes through the corpus helper.
// 3. Assert the native Engine reports the annotated diagnostic.
// @evidence contracts/testing.md#behavioral-verification A unary numeric literal must be recognized as an inferrable initializer.
// @evidence contracts/testing.md#independent-expectations The independently authored fixture markers require exactly typescript/no-inferrable-types error findings at lines 2; complete rule/severity/line comparison rejects missing, extra or misidentified reports.
// @evidence contracts/testing.md#distinguishing-cases The same negative literal without an annotation remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleNoInferrableTypesUnaryNumeric executes the AST Engine through assertRuleCorpusCase and an independently authored zero-finding counterpart through assertRuleSkipsSource in the same Go unit process; no native build, installation or compiler child runs.
func TestRuleNoInferrableTypesUnaryNumeric(t *testing.T) {
  assertRuleCorpusCase(t, "no-inferrable-types-unary-numeric.ts", `// expect: typescript/no-inferrable-types error
const value: number = -1;
JSON.stringify(value);
`)
  assertRuleSkipsSource(t, "typescript/no-inferrable-types", "const value = -1;\n")
}
