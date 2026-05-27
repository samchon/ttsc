package linthost

import "testing"

// TestRuleCorpusUnicornNoNamedDefault verifies unicorn/no-named-default reports
// `import { default as X } from "..."` as an obfuscated default import.
//
// The rule dispatches on `KindImportDeclaration`, walks the NamedImports
// elements, and fires on each specifier whose `PropertyName` is the identifier
// `default`. The fixture pins the diagnostic at the specifier so anchoring on
// the inner node (not the whole declaration) stays covered.
//
// 1. Enable unicorn/no-named-default via an expect annotation.
// 2. Import the default export under a named alias.
// 3. Assert the specifier is reported.
func TestRuleCorpusUnicornNoNamedDefault(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-named-default.ts", "// expect: unicorn/no-named-default error\nimport { default as React } from \"react\";\nvoid React;\n")
}
