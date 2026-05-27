package linthost

import "testing"

// TestRuleCorpusUnicornRequireModuleSpecifiers verifies
// unicorn/require-module-specifiers reports a bindings-free
// side-effect import declaration.
//
// The rule fires on both the bare side-effect `import "x"` shape and
// on `export {} from "x"`; pinning the import shape here exercises
// the `ImportClause == nil` branch that gates side-effect imports.
//
// 1. Enable unicorn/require-module-specifiers via an expect annotation.
// 2. Write a side-effect import with no binding clause.
// 3. Assert the import declaration is reported.
func TestRuleCorpusUnicornRequireModuleSpecifiers(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/require-module-specifiers.ts", "// expect: unicorn/require-module-specifiers error\nimport \"./side-effect.js\";\n")
}
