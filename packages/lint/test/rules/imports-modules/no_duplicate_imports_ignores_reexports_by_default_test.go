package linthost

import "testing"

// TestNoDuplicateImportsIgnoresReexportsByDefault verifies the official
// default `includeExports: false` leaves `export … from` declarations
// out of the analysis entirely.
//
// Locks the option gate in the rule's statement walk: without
// `includeExports`, re-exports are neither reported nor recorded, so a
// re-export of an imported module and even two identical re-exports stay
// silent. This is the negative twin of every include-exports case.
//
// 1. Import from "m", then re-export from "m" twice.
// 2. Run the rule with default options.
// 3. Assert zero findings.
func TestNoDuplicateImportsIgnoresReexportsByDefault(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
export { first } from "m";
export { second } from "m";
`, `{}`)
  assertNoDuplicateImportsFindings(t, got)
}
