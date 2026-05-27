package linthost

import "testing"

// TestRuleCorpusNoDuplicateImports verifies the lint rule corpus
// fixture no-duplicate-imports.ts.
//
// The rule collects every `import … from "…"` declaration at the
// source-file root and reports the second occurrence of a previously
// seen module specifier.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusNoDuplicateImports(t *testing.T) {
	assertRuleCorpusCase(t, "no-duplicate-imports.ts", "import { stringify } from \"node:querystring\";\n// expect: no-duplicate-imports error\nimport { parse } from \"node:querystring\";\nJSON.stringify({ stringify, parse });\n")
}
