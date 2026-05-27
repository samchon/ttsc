package linthost

import "testing"

// TestRuleCorpusUnicornPreferImportMetaProperties verifies the rule reports
// the legacy `fileURLToPath(import.meta.url)` pattern.
//
// The rule's single branch matches a `fileURLToPath` call whose argument is
// `import.meta.url`; this is the canonical pre-`import.meta.dirname` recipe
// and the only shape the rule rewrites, so the fixture pins it directly.
//
// 1. Enable unicorn/prefer-import-meta-properties via an expect annotation.
// 2. Call `fileURLToPath(import.meta.url)` on a declared shim of the helper.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferImportMetaProperties(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-import-meta-properties.ts", "declare function fileURLToPath(url: string): string;\n// expect: unicorn/prefer-import-meta-properties error\nconst filename = fileURLToPath(import.meta.url);\nvoid filename;\n")
}
