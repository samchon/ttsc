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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an import declaration has no imported binding; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/require-module-specifiers annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a named import declaration identifies the imported binding. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornRequireModuleSpecifiers is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornRequireModuleSpecifiers(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/require-module-specifiers.ts", "// expect: unicorn/require-module-specifiers error\nimport \"./side-effect.js\";\n")
  assertRuleSkipsSource(t, "unicorn/require-module-specifiers", "import { value } from \"./module.js\"; void value;\n")
}
