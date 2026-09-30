package linthost

import "testing"

// TestRuleCorpusNoRequireImports verifies the lint rule corpus fixture no-require-imports.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-require-imports.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the authored require call while permitting static ES imports and dynamic import syntax.
// @evidence contracts/testing.md#independent-expectations The supported rule forbids require-style imports; ECMAScript import declaration/expression forms are independently valid controls.
// @evidence contracts/testing.md#distinguishing-cases Preserves the original require finding and adds both static and dynamic import controls, distinguishing the callee style from all module loading.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase executes the original annotated require fixture; runRuleFindingsSnapshot executes the static/dynamic import controls. This Test owns their diagnostic contrast without loading real consumer modules.
func TestRuleCorpusNoRequireImports(t *testing.T) {
  assertRuleCorpusCase(t, "no-require-imports.ts", "// expect: typescript/no-require-imports error\nconst fs = require(\"fs\");\nJSON.stringify(fs);\n")
  _, _, clean := runRuleFindingsSnapshot(t, "typescript/no-require-imports", "import value from \"virtual-module\";\nconst dynamic = import(\"virtual-module\");\nconsole.log(value, dynamic);\n", nil)
  if len(clean) != 0 {
    t.Fatalf("supported neighboring import/module forms were reported: %+v", clean)
  }
}
