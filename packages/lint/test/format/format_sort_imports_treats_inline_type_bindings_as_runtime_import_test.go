package linthost

import "testing"

// TestFormatSortImportsTreatsInlineTypeBindingsAsRuntimeImport verifies only a
// clause-level `import type` declaration enters the erased-block safe path.
//
// `import { type T }` still uses a runtime import declaration and can become an
// evaluating `import {}` under verbatim module syntax. Classifying it from the
// specifier modifier would therefore weaken the evaluation-order guard.
//
//  1. Parse an inline-type binding before a lexically earlier type-only import.
//  2. Apply format/sort-imports with safe defaults.
//  3. Assert the mixed runtime/type block remains unchanged.
func TestFormatSortImportsTreatsInlineTypeBindingsAsRuntimeImport(t *testing.T) {
  source := "import { type Zebra } from \"./zebra\";\n" +
    "import type { Alpha } from \"./alpha\";\n"
  assertRuleSkipsSource(t, "format/sort-imports", source)
}
