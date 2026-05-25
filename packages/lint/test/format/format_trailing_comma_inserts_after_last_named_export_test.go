package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastNamedExport verifies named export
// lists get trailing commas when split across multiple lines.
//
// `export { a, b }` mirrors the named-import shape but goes through the
// separate `KindNamedExports` dispatch arm with its own `node.AsNamedExports()`
// extractor. Pinning this case keeps the symmetry with NamedImports — every
// diff that adds a re-exported symbol stays one-line otherwise, which is the
// same readability gain the named-import test pins.
//
// 1. Parse a source file with one multi-line named export.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma after the last specifier.
func TestFormatTrailingCommaInsertsAfterLastNamedExport(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "const alpha = 1;\nconst beta = 2;\nexport {\n  alpha,\n  beta\n};\n",
    "const alpha = 1;\nconst beta = 2;\nexport {\n  alpha,\n  beta,\n};\n",
  )
}
