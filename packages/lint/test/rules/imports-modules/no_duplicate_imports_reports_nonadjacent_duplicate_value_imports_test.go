package linthost

import "testing"

// TestNoDuplicateImportsReportsNonadjacentDuplicateValueImports verifies
// no-duplicate-imports reports a duplicate even when an unrelated import
// sits between the two same-module declarations.
//
// Locks the per-module bookkeeping in the rule's `modules` map: the
// duplicate comparison keys on the module specifier, not on adjacency,
// so an intervening import of a different module must neither reset the
// tracking nor produce a finding of its own.
//
// 1. Import from "m", then from an unrelated module, then from "m" again.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the third line.
func TestNoDuplicateImportsReportsNonadjacentDuplicateValueImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import { first } from "m";
import { other } from "other";
import { second } from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 3, Message: "`m` import is duplicated."},
  })
}
