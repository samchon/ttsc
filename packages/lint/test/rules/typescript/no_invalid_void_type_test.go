package linthost

import "testing"

// TestRuleCorpusTypescriptNoInvalidVoidType verifies the lint rule
// corpus fixture typescript-no-invalid-void-type.ts.
//
// The rule fires on `void` used as a union constituent or as a
// non-allow-listed generic argument. `Promise<void>`, function return
// types, and `void X` expressions are all valid positions.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
// @evidence contracts/testing.md#behavioral-verification Void used as a union constituent must report.
// @evidence contracts/testing.md#independent-expectations The independently authored fixture markers require exactly typescript/no-invalid-void-type error findings at lines 2; complete rule/severity/line comparison rejects missing, extra or misidentified reports.
// @evidence contracts/testing.md#distinguishing-cases Promise<void>, void function returns and void expressions exercise allowed syntactic positions.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTypescriptNoInvalidVoidType executes the AST Engine through assertRuleCorpusCase and an independently authored zero-finding counterpart through assertRuleSkipsSource in the same Go unit process; no native build, installation or compiler child runs.
func TestRuleCorpusTypescriptNoInvalidVoidType(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-no-invalid-void-type.ts", "// expect: typescript/no-invalid-void-type error\ntype Result = string | void;\nJSON.stringify({} as Result);\n")
  assertRuleSkipsSource(t, "typescript/no-invalid-void-type", "type Completion = Promise<void>;\nfunction f(): void { void 0; }\n")
}
