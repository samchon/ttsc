package linthost

import "testing"

// TestRuleCorpusUnicornNoNamedDefault verifies unicorn/no-named-default reports
// `import { default as X } from "..."` as an obfuscated default import.
//
// The rule dispatches on `KindImportDeclaration`, walks the NamedImports
// elements, and fires on each specifier whose `PropertyName` is the identifier
// `default`. The fixture pins the diagnostic at the specifier so anchoring on
// the inner node (not the whole declaration) stays covered.
//
// 1. Enable unicorn/no-named-default via an expect annotation.
// 2. Import the default export under a named alias.
// 3. Assert the specifier is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a named-import specifier imports default as React; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-named-default annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the dedicated default-import syntax binds React. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoNamedDefault is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoNamedDefault(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-named-default.ts", "// expect: unicorn/no-named-default error\nimport { default as React } from \"react\";\nvoid React;\n")
  assertRuleSkipsSource(t, "unicorn/no-named-default", "import React from \"react\"; void React;\n")
}
