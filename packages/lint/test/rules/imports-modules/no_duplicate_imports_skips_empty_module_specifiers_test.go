package linthost

import "testing"

// TestNoDuplicateImportsSkipsEmptyModuleSpecifiers verifies imports with
// an empty (or whitespace-only) module string never participate in the
// duplicate comparison.
//
// Locks the empty-module guard: the official `handleImportsExports`
// skips declarations whose trimmed module name is falsy, so even two
// identical empty-specifier imports are not duplicates of each other.
// Removing the guard would key both under "" and report the second.
//
//  1. Write two `import { … } from ""` declarations and one whitespace-only
//     specifier.
//  2. Run the rule with default options.
//  3. Assert zero findings.
func TestNoDuplicateImportsSkipsEmptyModuleSpecifiers(t *testing.T) {
  got := runNoDuplicateImports(t, `import { first } from "";
import { second } from "";
import { third } from "  ";
`, `{}`)
  assertNoDuplicateImportsFindings(t, got)
}
