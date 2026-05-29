package linthost

import "testing"

// TestRuleCorpusUnicornPreferExportFrom verifies unicorn/prefer-export-from
// reports an `import { X } from "Y"` followed by an `export { X };`.
//
// The MVP only catches the textbook re-export pair: a non-renamed named
// import whose binding is later re-exported by an identifier-only export
// with no from-clause. This fixture pins that shape so the SourceFile
// statement-walk and the import/export specifier pairing stay covered.
//
// 1. Enable unicorn/prefer-export-from via an expect annotation.
// 2. Import `useState` from `"react"` and immediately re-export it.
// 3. Assert the export statement is reported.
func TestRuleCorpusUnicornPreferExportFrom(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-export-from.ts", "import { useState } from \"react\";\n// expect: unicorn/prefer-export-from error\nexport { useState };\n")
}
