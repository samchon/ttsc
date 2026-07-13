package linthost

import "testing"

// TestNoDuplicateImportsReportsEachLaterDuplicateImport verifies three
// mergeable imports of one module produce a finding on the second AND
// the third declaration.
//
// Locks the recording rule: a declaration is appended to the module's
// entry list even after being reported, so every later occurrence still
// finds a mergeable predecessor. Dropping reported declarations from the
// bookkeeping would silence the third import.
//
// 1. Import named bindings from the same module three times.
// 2. Run the rule with default options.
// 3. Assert duplicate-import findings on lines two and three.
func TestNoDuplicateImportsReportsEachLaterDuplicateImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { first } from "m";
import { second } from "m";
import { third } from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
    {Line: 3, Message: "`m` import is duplicated."},
  })
}
