package linthost

import "testing"

// TestNoDuplicateImportsReportsTwoTypeDefaultImports verifies two
// type-only default imports of the same module are still reported.
//
// Positive twin of the ESLint 9.30.1 exemption: the type-only guard in
// `duplicateImportsCanMerge` excludes only the default/named pairing.
// Two type-only defaults reference the same export and reduce to one
// declaration, so widening the guard to every type-only pair would be a
// regression this case catches.
//
// 1. Import two type-only default bindings from the same module.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsReportsTwoTypeDefaultImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import type First from "m";
import type Second from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
