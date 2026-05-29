package linthost

import "testing"

// TestRuleCorpusMaxClassesPerFile verifies the lint rule corpus fixture max-classes-per-file.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in max-classes-per-file.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusMaxClassesPerFile(t *testing.T) {
  assertRuleCorpusCase(t, "max-classes-per-file.ts", "// Positive: declaring two classes in the same file exceeds the default\n// ceiling of one. The finding anchors on the second class because it is\n// the declaration that pushed the count past the limit.\nclass First {\n  value(): number {\n    return 1;\n  }\n}\n\n// expect: max-classes-per-file error\nclass Second {\n  value(): number {\n    return 2;\n  }\n}\n\n// Negative: nested class expressions still count toward the file total,\n// but a fixture with a single class would be silent — exercising the\n// rule requires the multi-class shape above.\n\nJSON.stringify({\n  first: new First().value(),\n  second: new Second().value(),\n});\n")
}
