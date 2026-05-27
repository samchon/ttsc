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
func TestRuleCorpusUnicornPreferBlobReadingMethods(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-blob-reading-methods.ts", "declare const reader: FileReader;\ndeclare const blob: Blob;\n// expect: unicorn/prefer-blob-reading-methods error\nreader.readAsArrayBuffer(blob);\n")
}
