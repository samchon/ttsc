package linthost

import "testing"

// TestNoDuplicateImportsReportsDefaultThenNamedValueImports verifies
// no-duplicate-imports reports a named value import following a default
// value import of the same module.
//
// Locks the mergeable cross-category pairing in
// `duplicateImportsCanMerge`: a default binding and named bindings share
// one legal declaration (`import def, { a } from "m"`), so the pair is a
// duplicate even though the categories differ. This is the value-kind
// negative twin of the type-only default/named exemption, which must not
// leak into value declarations.
//
// 1. Import a default binding and then named bindings from one module.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsReportsDefaultThenNamedValueImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import def from "m";
import { named } from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
