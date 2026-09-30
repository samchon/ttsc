package linthost

import "testing"

// TestRuleCorpusNoProto verifies the lint rule corpus fixture no-proto.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-proto.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports legacy __proto__ access while permitting Object.getPrototypeOf and an ordinary proto-named member.
// @evidence contracts/testing.md#independent-expectations The deprecated legacy property policy distinguishes the standard prototype API; the original annotation fixes the offending access independently.
// @evidence contracts/testing.md#distinguishing-cases __proto__ reports; getPrototypeOf and the ordinary proto property stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoProto owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusNoProto(t *testing.T) {
  assertRuleCorpusCase(t, "no-proto.ts", "const o: any = {};\n// expect: no-proto error\nJSON.stringify(o.__proto__);\n")
  assertRuleSkipsSource(t, "no-proto", "Object.getPrototypeOf(obj); obj.proto;\n")
}
