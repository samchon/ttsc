package linthost

import "testing"

// TestNoDuplicateImportsAllowsInlineTypeSpecifierBesideTypeImport
// verifies `allowSeparateTypeImports: true` accepts a clause-level type
// import next to an inline-type-specifier import of the same module.
//
// Companion of the inline-classification case: because `import { type B
// }` is a value declaration, the option's type/value separation exempts
// it from comparison with the clause-level `import type { A }` above.
// Together the two cases pin the inline form to exactly the value side —
// compared against value imports, separated from type imports.
//
//  1. Import clause-level type bindings, then an inline-type specifier,
//     from one module.
//  2. Run the rule with `allowSeparateTypeImports: true`.
//  3. Assert zero findings.
func TestNoDuplicateImportsAllowsInlineTypeSpecifierBesideTypeImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import type { Alpha } from "m";
import { type Beta } from "m";
`, `{"allowSeparateTypeImports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
