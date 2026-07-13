package linthost

import "testing"

// TestNoDuplicateImportsIgnoresMisspelledOptionKeys verifies a
// misspelled option key leaves the rule on its official defaults
// instead of disabling it or panicking.
//
// Locks the options decode path: `DecodeOptions` ignores unknown JSON
// keys, so `allowSeparateTypeImport` (missing the trailing `s`) must not
// activate the type/value separation. The Go layer mirrors the
// compile-time typo rejection asserted in the TypeScript typing test —
// the native engine is the runtime backstop for untyped config files
// such as lint.config.json.
//
// 1. Import a value binding and a clause-level type binding from one module.
// 2. Run the rule with a misspelled `allowSeparateTypeImport` key.
// 3. Assert the default behavior still reports the second declaration.
func TestNoDuplicateImportsIgnoresMisspelledOptionKeys(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
import type { Entity } from "m";
`, `{"allowSeparateTypeImport":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
