package linthost

import "testing"

// TestNoDuplicateImportsAllowsNamedAndNamespaceValueImports verifies
// no-duplicate-imports accepts a named and a namespace import of the
// same module, in both declaration orders.
//
// Locks the namespace/named exclusion in `duplicateImportsCanMerge`:
// TypeScript has no declaration form carrying both `* as ns` and named
// bindings, so the pair is not consolidatable and must not be reported.
// Both orders exercise both operand sides of the symmetric guard; the
// old specifier-string implementation reported both, so this is the
// regression pin for issue #401's second consequence.
//
// 1. Import named-then-namespace from "m" and namespace-then-named from "n".
// 2. Run the rule with default options.
// 3. Assert zero findings.
func TestNoDuplicateImportsAllowsNamedAndNamespaceValueImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import { named } from "m";
import * as namespace from "m";
import * as other from "n";
import { thing } from "n";
`, `{}`)
  assertNoDuplicateImportsFindings(t, got)
}
