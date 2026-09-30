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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a named import is immediately re-exported locally; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-export-from annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; an export-from declaration directly forwards the same binding. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferExportFrom is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferExportFrom(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-export-from.ts", "import { useState } from \"react\";\n// expect: unicorn/prefer-export-from error\nexport { useState };\n")
  assertRuleSkipsSource(t, "unicorn/prefer-export-from", "export { useState } from \"react\";\n")
}
