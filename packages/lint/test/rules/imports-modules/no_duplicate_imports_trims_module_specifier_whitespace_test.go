package linthost

import "testing"

// TestNoDuplicateImportsTrimsModuleSpecifierWhitespace verifies module
// specifiers are compared after trimming surrounding whitespace.
//
// Locks `duplicateImportsModule` parity with the official `getModule`,
// which compares `source.value.trim()`. Without trimming, `" m "` and
// `"m"` would silently count as different modules and the pair would
// escape the duplicate comparison.
//
// 1. Import from `"m"` and then from `" m "`.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsTrimsModuleSpecifierWhitespace(t *testing.T) {
  got := runNoDuplicateImports(t, `import { first } from "m";
import { second } from " m ";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
