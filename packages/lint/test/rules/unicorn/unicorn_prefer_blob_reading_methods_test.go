package linthost

import "testing"

// TestRuleCorpusUnicornPreferBlobReadingMethods verifies the rule
// reports `reader.readAsArrayBuffer(blob)` on a declared FileReader.
//
// Identifier-text-driven on the method name; the receiver is not
// type-checked. The fixture pins the property-access-call branch that
// rejects the legacy callback-based FileReader API in favor of the
// promise-returning `Blob#arrayBuffer()` / `Blob#text()` methods.
//
// 1. Enable unicorn/prefer-blob-reading-methods via an expect annotation.
// 2. Call `reader.readAsArrayBuffer(blob)` on declared bindings.
// 3. Assert the call site is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies FileReader reads a Blob into an array buffer; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-blob-reading-methods annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the Blob arrayBuffer method exposes the read operation. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferBlobReadingMethods is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferBlobReadingMethods(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-blob-reading-methods.ts", "declare const reader: FileReader;\ndeclare const blob: Blob;\n// expect: unicorn/prefer-blob-reading-methods error\nreader.readAsArrayBuffer(blob);\n")
  assertRuleSkipsSource(t, "unicorn/prefer-blob-reading-methods", "declare const blob: Blob; blob.arrayBuffer();\n")
}
