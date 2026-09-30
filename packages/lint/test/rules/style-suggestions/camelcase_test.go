package linthost

import "testing"

// TestRuleCorpusCamelcase verifies the lint rule corpus fixture
// camelcase.ts.
//
// The rule rejects snake_case bindings in favor of either camelCase or
// PascalCase. Leading underscores (`_private`) and SCREAMING_SNAKE
// constants are tolerated; an interior underscore between two letters
// remains the canonical violation the fixture pins.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Reports snake-case variable/function/class/parameter bindings while permitting camel/Pascal case, leading underscore and uppercase constants.
// @evidence contracts/testing.md#independent-expectations The authored naming policy and literal annotation positions independently distinguish the four forbidden bindings from allowed exceptions.
// @evidence contracts/testing.md#distinguishing-cases Multiple binding kinds and underscore/constant exceptions prevent testing only one identifier spelling.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's independently annotated fixture through the Go engine and compares rule/severity/line triples. This Test owns all marked violations and unmarked controls. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestRuleCorpusCamelcase(t *testing.T) {
  assertRuleCorpusCase(t, "camelcase.ts", "// expect: camelcase error\nconst snake_value: number = 1;\nconst camelValue: number = 2;\nconst PascalValue: number = 3;\nconst _private: number = 4;\nconst MAX_VALUE: number = 5;\nfunction goodName(): void {}\n// expect: camelcase error\nfunction bad_name(): void {}\nclass GoodClass {}\n// expect: camelcase error\nclass bad_class {}\nfunction take(good: number, _ignored: number): void {\n  void good;\n  void _ignored;\n}\n// expect: camelcase error\nfunction takeBad(bad_param: number): void {\n  void bad_param;\n}\nJSON.stringify({ snake_value, camelValue, PascalValue, _private, MAX_VALUE, goodName, bad_name, GoodClass, bad_class, take, takeBad });\n")
}
