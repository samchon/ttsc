package linthost

import "testing"

// TestRuleCorpusGetterReturn verifies the lint rule corpus fixture
// getter-return.ts.
//
// The rule checks the last statement of a getter body for a value-
// returning return or throw. Conditional getters whose else branch
// falls through also fire.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the getter with no returned value and permits a value-returning getter.
// @evidence contracts/testing.md#independent-expectations The accessor value contract independently distinguishes expression statements from returning a value.
// @evidence contracts/testing.md#distinguishing-cases Original getter fallthrough reports; a getter returning 1 stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusGetterReturn is selected in the shared Go unit population. It calls assertRuleCorpusCase with getter-return.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusGetterReturn(t *testing.T) {
  assertRuleCorpusCase(t, "getter-return.ts", "class Foo {\n  // expect: getter-return error\n  get value(): number {\n    JSON.stringify({});\n  }\n}\nJSON.stringify(Foo);\n")
  assertRuleSkipsSource(t, "getter-return", "class Foo { get value() { return 1; } }\n")
}
