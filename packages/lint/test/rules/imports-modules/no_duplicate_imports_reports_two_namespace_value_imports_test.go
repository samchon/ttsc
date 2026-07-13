package linthost

import "testing"

// TestNoDuplicateImportsReportsTwoNamespaceValueImports verifies
// no-duplicate-imports reports two namespace imports of the same module.
//
// Positive twin of the namespace/named exclusion: the guard in
// `duplicateImportsCanMerge` only excludes namespace-beside-named pairs,
// while two namespace bindings of one module remain an ordinary
// duplicate (one binding can serve both call sites). An over-broad
// namespace exemption would silently stop reporting this shape.
//
// 1. Import `* as a` and `* as b` from the same module.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsReportsTwoNamespaceValueImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import * as first from "m";
import * as second from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
