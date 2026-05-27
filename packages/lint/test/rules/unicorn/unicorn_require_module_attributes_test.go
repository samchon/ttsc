package linthost

import "testing"

// TestRuleCorpusUnicornRequireModuleAttributes verifies the rule reports
// an import declaration whose `with {}` attributes clause is empty.
//
// Import / export `with { … }` clauses carry semantic information.
// Writing `with {}` with no attributes is almost always a mistake. The
// rule reads the typed `Attributes` accessor on `KindImportDeclaration`
// / `KindExportDeclaration`, descends into the `ImportAttributes` node,
// and fires when its `Attributes` element list has zero entries. The
// fixture pins that empty-list branch.
//
// 1. Enable unicorn/require-module-attributes via an expect annotation.
// 2. Write `import data from "./data.json" with {};`.
// 3. Assert the import declaration is reported.
func TestRuleCorpusUnicornRequireModuleAttributes(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/require-module-attributes.ts", "// expect: unicorn/require-module-attributes error\nimport data from \"./data.json\" with {};\nvoid data;\n")
}
