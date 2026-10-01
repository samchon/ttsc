package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastNamedExport verifies named export
// lists get trailing commas when split across multiple lines.
//
// Named exports have their own list owner. The edit must affect only the final specifier punctuation while preserving the exported bindings.
//
// 1. Parse a source file with one multi-line named export.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma after the last specifier.
//
// @evidence contracts/testing.md#behavioral-verification The named export list must gain a comma after beta while retaining alpha, both const declarations and their export order.
// @evidence contracts/testing.md#independent-expectations Prettier applies terminal commas to broken named export specifiers. The literal expected file independently fixes punctuation and preserves which bindings are exported.
// @evidence contracts/testing.md#distinguishing-cases The named export is positive with two ordinary specifiers. Named-import insertion and inline/canonical list negatives provide sibling and layout distinctions.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastNamedExport owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastNamedExport(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "const alpha = 1;\nconst beta = 2;\nexport {\n  alpha,\n  beta\n};\n",
    "const alpha = 1;\nconst beta = 2;\nexport {\n  alpha,\n  beta,\n};\n",
  )
}
