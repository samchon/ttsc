package linthost

import "testing"

// TestNoDuplicateImportsAllowSeparateTypeImportsAllowsValuePlusTypeImport
// verifies `allowSeparateTypeImports: true` accepts one value import
// plus one clause-level type import of the same module, in both orders.
//
// Locks the option's skip branch in `duplicateImportsShouldReport`: when
// the new and the earlier declaration differ in clause-level type-ness,
// the pair is exempt from the mergeability comparison. Both orders
// exercise the comparison from the value side and from the type side.
//
//  1. Import a default value binding then clause-level type bindings from
//     "m", and type bindings then a value binding from "n".
//  2. Run the rule with `allowSeparateTypeImports: true`.
//  3. Assert zero findings.
func TestNoDuplicateImportsAllowSeparateTypeImportsAllowsValuePlusTypeImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import api from "m";
import type { IEntity } from "m";
import type { IOther } from "n";
import { other } from "n";
`, `{"allowSeparateTypeImports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
