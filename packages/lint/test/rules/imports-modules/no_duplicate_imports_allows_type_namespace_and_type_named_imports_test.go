package linthost

import "testing"

// TestNoDuplicateImportsAllowsTypeNamespaceAndTypeNamedImports verifies
// a type-only namespace import and a type-only named import of the same
// module are accepted.
//
// Locks the interaction of the two exclusions in
// `duplicateImportsCanMerge`: the type-only default/named guard does not
// match this pair (neither side is a default), so acceptance must come
// from the general namespace/named exclusion — which applies to
// type-only declarations exactly as it does to value declarations.
//
// 1. Import `type * as ns` and then `type { Named }` from one module.
// 2. Run the rule with default options.
// 3. Assert zero findings.
func TestNoDuplicateImportsAllowsTypeNamespaceAndTypeNamedImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import type * as namespace from "m";
import type { NamedType } from "m";
`, `{}`)
  assertNoDuplicateImportsFindings(t, got)
}
