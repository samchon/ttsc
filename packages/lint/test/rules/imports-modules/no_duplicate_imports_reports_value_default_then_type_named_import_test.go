package linthost

import "testing"

// TestNoDuplicateImportsReportsValueDefaultThenTypeNamedImport verifies
// the default configuration reports a clause-level type named import
// after a value default import of the same module.
//
// Pins the both-type precondition of the ESLint 9.30.1 guard in
// `duplicateImportsCanMerge`: the default/named exemption applies only
// when BOTH declarations are type-only. This pair has the exempted
// category shape (default beside named) but only one type-only side, so
// it merges into `import def, { type Named } from "m"` and must report.
// A guard loosened to exempt the pair when either side is type-only
// would go silent here.
//
//  1. Import a value default binding, then clause-level named type
//     bindings, from one module.
//  2. Run the rule with default options.
//  3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsReportsValueDefaultThenTypeNamedImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import def from "m";
import type { Named } from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
