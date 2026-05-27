package linthost

import "testing"

// TestRuleCorpusTypeScriptNoUselessConstructor verifies the lint rule
// corpus fixture typescript-no-useless-constructor.ts.
//
// `typescript/no-useless-constructor` is AST-only: it fires on a
// `KindConstructor` whose body is an empty block and whose parameter
// list contains no parameter property. The fixture pins both halves of
// the split: empty bodies without parameter properties (positive) and
// constructors that exist solely to declare a parameter-property field
// (negative).
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusTypeScriptNoUselessConstructor(t *testing.T) {
	assertRuleCorpusCase(t, "typescript-no-useless-constructor.ts", "// Positive: empty body, no parameters.\nclass EmptyNoParams {\n  // expect: typescript/no-useless-constructor error\n  constructor() {}\n}\n\n// Positive: empty body, plain parameters.\nclass EmptyPlainParams {\n  // expect: typescript/no-useless-constructor error\n  constructor(_name: string, _count: number) {}\n}\n\n// Negative: parameter property declares a field.\nclass WithParameterProperty {\n  constructor(public name: string) {}\n}\n\n// Negative: at least one parameter is a parameter property.\nclass MixedParameters {\n  constructor(\n    public id: number,\n    _plain: string,\n  ) {}\n}\n\n// Negative: non-empty body.\nclass WithBody {\n  count: number;\n  constructor() {\n    this.count = 0;\n  }\n}\n\nJSON.stringify({\n  EmptyNoParams,\n  EmptyPlainParams,\n  WithParameterProperty,\n  MixedParameters,\n  WithBody,\n});\n")
}
