package linthost

import "testing"

// TestRuleCorpusNoPrototypeBuiltins verifies the lint rule corpus fixture no-prototype-builtins.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-prototype-builtins.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine rejects the original own-method hasOwnProperty call while permitting invocation through Object.prototype.call.
// @evidence contracts/testing.md#independent-expectations An object can shadow hasOwnProperty; the independently allowed prototype call bypasses that own-property hazard.
// @evidence contracts/testing.md#distinguishing-cases The original direct call reports; Object.prototype.hasOwnProperty.call on the same-shaped box remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoPrototypeBuiltins owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusNoPrototypeBuiltins(t *testing.T) {
  assertRuleCorpusCase(t, "no-prototype-builtins.ts", "const o: any = {};\n// expect: no-prototype-builtins error\no.hasOwnProperty(\"x\");\n")
  assertRuleSkipsSource(t, "no-prototype-builtins", "Object.prototype.hasOwnProperty.call(box, \"x\");\n")
}
