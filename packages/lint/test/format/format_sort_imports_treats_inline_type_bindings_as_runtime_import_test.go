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
//
// @evidence contracts/testing.md#behavioral-verification The inline-type Zebra declaration must remain before clause-level type Alpha with zero findings under safe defaults.
// @evidence contracts/testing.md#independent-expectations The supported runtime guard distinguishes clause-level import type from a normal import containing inline type bindings. The literal source must be preserved because verbatim module syntax can retain an evaluating empty import.
// @evidence contracts/testing.md#distinguishing-cases Every binding appears type-related but only Alpha is clause-level erased. The all-clause-type sorting positive distinguishes actual declaration phase from specifier spelling.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsTreatsInlineTypeBindingsAsRuntimeImport owns its literal inline-type/clause-type input and default-options zero-finding assertion in the selected public Go unit population. Parsing, owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsTreatsInlineTypeBindingsAsRuntimeImport(t *testing.T) {
  source := "import { type Zebra } from \"./zebra\";\n" +
    "import type { Alpha } from \"./alpha\";\n"
  assertRuleSkipsSource(t, "format/sort-imports", source)
}
