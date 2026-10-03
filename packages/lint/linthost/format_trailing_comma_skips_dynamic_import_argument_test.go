package linthost

import "testing"

// TestFormatTrailingCommaSkipsDynamicImportArgument verifies the rule
// never appends a trailing comma to a multi-line dynamic `import(...)`
// argument list, even under the default trailingComma:"all".
//
// The local supported policy exempts dynamic import from comma insertion. Ordinary calls must still follow all-mode multiline insertion, so exempting every call would be wrong.
//
//  1. Parse a multiline dynamic import and an ordinary load-call twin.
//  2. Run the rule with default (mode "all") options.
//  3. Require no import finding and exact ordinary-call comma insertion.
//
// @evidence contracts/testing.md#behavioral-verification A dynamic import must remain comma-free under all mode while an ordinary call with the same multiline argument gains its final comma. The pair detects both missing the import exception and excluding every call.
// @evidence contracts/testing.md#independent-expectations The authored pair specifies the local supported dynamic-import exception and the ordinary-call all-mode comma independently of the callee-kind switch. This direct unit does not execute a reference formatter.
// @evidence contracts/testing.md#distinguishing-cases The original dynamic import negative stays. An ordinary load call with the same module string supplies an adjacent all-mode positive at the same line-break boundary.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaSkipsDynamicImportArgument owns every authored source, no-finding or complete-output assertion in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaSkipsDynamicImportArgument(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/trailing-comma",
    "const m = import(\n  \"./mod\"\n);\n",
  )
  assertFixSnapshot(t, "format/trailing-comma",
    "const m = load(\n  \"./mod\"\n);\n",
    "const m = load(\n  \"./mod\",\n);\n")
}
