package linthost

import "testing"

// TestRuleCorpusPreferAsConst verifies the lint rule corpus fixture prefer-as-const.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in prefer-as-const.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusPreferAsConst(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-as-const.ts", "// expect: typescript/prefer-as-const error\nconst asserted = \"foo\" as \"foo\";\n// expect: typescript/prefer-as-const error\nconst angled = <4>4;\n// expect: typescript/prefer-as-const error\nlet numeric: 2 = 2;\n// expect: typescript/prefer-as-const error\nlet flag: true = true;\n// expect: typescript/prefer-as-const error\nlet big: 10n = 10n;\n// expect: typescript/prefer-as-const error\nlet []: \"bar\" = \"bar\";\n// expect: typescript/prefer-as-const error\nlet nested: \"deep\" = \"deep\" as \"deep\";\n\nclass Holder {\n  // expect: typescript/prefer-as-const error\n  public value: \"value\" = \"value\";\n  // expect: typescript/prefer-as-const error\n  static count: 1 = 1;\n  accessor tracked: \"on\" = \"on\";\n  label: string = \"wide\";\n  bare?: \"alone\";\n}\n\nenum Level {\n  low = \"low\",\n}\n\nfunction pick(kind: \"left\" = \"left\"): string {\n  return kind;\n}\n\nlet differentQuotes = 'value' as \"value\";\nlet quotedAnnotation: \"value\" = 'value';\nlet echoed: \"value\" = quotedAnnotation;\nlet differentSpelling: 10 = 0xa;\nlet template = `tpl` as `tpl`;\nlet nullish = null as null;\nlet widened: string = \"wide\";\nlet alone: \"alone\";\nalone = \"alone\";\nlet assertedConst: \"done\" = \"done\" as const;\n\nnumeric = 2;\nflag = true;\n\nexport {\n  alone,\n  angled,\n  asserted,\n  assertedConst,\n  big,\n  differentQuotes,\n  differentSpelling,\n  echoed,\n  flag,\n  Holder,\n  Level,\n  nested,\n  nullish,\n  numeric,\n  pick,\n  quotedAnnotation,\n  template,\n  widened,\n};\n")
}
