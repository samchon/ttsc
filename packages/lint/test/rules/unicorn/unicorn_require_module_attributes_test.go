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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a JSON import has an empty attributes object; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/require-module-attributes annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the same JSON import declares its JSON type attribute. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornRequireModuleAttributes is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornRequireModuleAttributes(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/require-module-attributes.ts", "// expect: unicorn/require-module-attributes error\nimport data from \"./data.json\" with {};\nvoid data;\n")
  assertRuleSkipsSource(t, "unicorn/require-module-attributes", "import data from \"./data.json\" with { type: \"json\" }; void data;\n")
}
