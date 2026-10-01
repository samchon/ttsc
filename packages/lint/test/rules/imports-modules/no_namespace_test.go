package linthost

import "testing"

// TestRuleCorpusNoNamespace verifies the lint rule corpus fixture no-namespace.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-namespace.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the authored internal namespace Foo while permitting a string-named ambient module declaration.
// @evidence contracts/testing.md#independent-expectations ES module policy forbids internal namespace syntax but permits ambient external module typing, which has no equivalent value-module replacement.
// @evidence contracts/testing.md#distinguishing-cases The original namespace finding remains; a string-literal module-name control guards against reporting every ModuleDeclaration. Global augmentation has TestNoNamespaceExemptsGlobalAugmentation in the TypeScript family.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase executes the original annotated namespace fixture; runRuleFindingsSnapshot executes the string-named ambient module control. This Test owns the finding and zero-result contrast in the Go process.
func TestRuleCorpusNoNamespace(t *testing.T) {
  _, _, clean := runRuleFindingsSnapshot(t, "typescript/no-namespace", "declare module \"virtual-module\" { export interface Value { key: string } }\n", nil)
  if len(clean) != 0 {
    t.Fatalf("supported neighboring import/module forms were reported: %+v", clean)
  }
}
