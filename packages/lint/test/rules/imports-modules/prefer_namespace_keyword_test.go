package linthost

import "testing"

// TestRuleCorpusPreferNamespaceKeyword verifies the lint rule corpus fixture prefer-namespace-keyword.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in prefer-namespace-keyword.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports module Foo while permitting namespace and ambient string-module forms.
// @evidence contracts/testing.md#independent-expectations The supported modern namespace spelling requires namespace for internal declarations, while ambient external modules necessarily retain module syntax.
// @evidence contracts/testing.md#distinguishing-cases The original module violation remains alongside namespace and ambient controls. TestFixPreferNamespaceKeywordReplacesModuleKeyword owns emitted replacement text and preserved body meaning.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase executes the original annotated module fixture; runRuleFindingsSnapshot executes namespace and string-module controls. This Test owns the report/clean contrast; the separate named fixer unit owns applying the emitted edit.
func TestRuleCorpusPreferNamespaceKeyword(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-namespace-keyword.ts", "// expect: typescript/prefer-namespace-keyword error\nmodule Foo {\n  export const x = 1;\n}\nJSON.stringify(Foo.x);\n")
  _, _, clean := runRuleFindingsSnapshot(t, "typescript/prefer-namespace-keyword", "namespace Modern { export const value = 1; }\ndeclare module \"virtual-module\" { export interface Value { key: string } }\n", nil)
  if len(clean) != 0 {
    t.Fatalf("supported neighboring import/module forms were reported: %+v", clean)
  }
}
