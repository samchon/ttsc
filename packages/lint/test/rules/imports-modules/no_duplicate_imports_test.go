package linthost

import "testing"

// TestRuleCorpusNoDuplicateImports verifies the lint rule corpus
// fixture no-duplicate-imports.ts.
//
// The rule reports a repeated module specifier only when the two
// declarations could be merged into one legal declaration. The fixture
// pins the official defaults: mergeable value pairs and value-plus-type
// pairs report, while named-beside-namespace and type-only
// default-beside-named pairs (ESLint 9.30.1 parity) do not.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoDuplicateImports(t *testing.T) {
  assertRuleCorpusCase(t, "no-duplicate-imports.ts", "// Positive: two mergeable named value imports of the same module.\nimport { first } from \"some-module\";\n// expect: no-duplicate-imports error\nimport { second } from \"some-module\";\n\n// Positive: under the official default (allowSeparateTypeImports: false),\n// a clause-level type import joins the comparison with the value import\n// above, and named type bindings merge with named value bindings.\nimport { runtime } from \"type-and-value\";\n// expect: no-duplicate-imports error\nimport type { IEntity } from \"type-and-value\";\n\n// Negative: named and namespace imports cannot be merged into one\n// declaration, so the repeated module specifier is not a duplicate.\nimport { named } from \"unmergeable-namespace\";\nimport * as namespace from \"unmergeable-namespace\";\n\n// Negative: a type-only default import and a type-only named import\n// cannot be merged into one declaration (ESLint 9.30.1 parity).\nimport type DefaultType from \"unmergeable-type-forms\";\nimport type { NamedType } from \"unmergeable-type-forms\";\n\n// Negative: imports from different modules.\nimport { alpha } from \"other-module-a\";\nimport { beta } from \"other-module-b\";\n\nJSON.stringify({ first, second, runtime, named, namespace, alpha, beta });\n")
}
