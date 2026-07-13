package linthost

import "testing"

// TestNoDuplicateImportsReportsValueThenTypeNamedImportByDefault
// verifies the default configuration reports a clause-level `import
// type` declaration whose module already has a value import above.
//
// Locks the official default `allowSeparateTypeImports: false`: without
// the option, clause-level type declarations join the ordinary duplicate
// comparison, and named value bindings merge with named type bindings
// into `import { a, type B } from "m"`. This is the negative twin of the
// option-enabled acceptance case.
//
// 1. Import named value bindings and then clause-level type bindings from "m".
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsReportsValueThenTypeNamedImportByDefault(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
import type { Entity } from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
