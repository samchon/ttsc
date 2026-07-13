package linthost

import "testing"

// TestNoDuplicateImportsReportsDefaultThenNamespaceValueImports verifies
// no-duplicate-imports reports a namespace import following a default
// import of the same module.
//
// Locks the mergeable default/namespace pairing: `import def, * as ns
// from "m"` is legal TypeScript, so the two declarations consolidate and
// the second one is a duplicate. Guards against widening the
// namespace/named exclusion in `duplicateImportsCanMerge` to every
// namespace pairing.
//
// 1. Import a default binding and then a namespace binding from one module.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsReportsDefaultThenNamespaceValueImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import def from "m";
import * as namespace from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
