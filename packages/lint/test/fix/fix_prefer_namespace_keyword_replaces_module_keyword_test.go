package linthost

import "testing"

// TestFixPreferNamespaceKeywordReplacesModuleKeyword verifies the
// preferNamespaceKeyword fixer swaps the legacy `module` keyword for
// `namespace`.
//
// The replacement is length-changing (6 → 9). `keywordStart` is the same
// helper the existing `noVar` fixer uses to anchor a keyword swap, so
// the only thing this test pins beyond the existing infrastructure is the
// rule wiring.
//
// 1. Parse a source file declaring `module Foo {}`.
// 2. Apply the finding through the disk-backed fixer.
// 3. Assert the keyword is now `namespace`.
func TestFixPreferNamespaceKeywordReplacesModuleKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "preferNamespaceKeyword",
    "module Foo {\n  export const x = 1;\n}\nJSON.stringify(Foo.x);\n",
    "namespace Foo {\n  export const x = 1;\n}\nJSON.stringify(Foo.x);\n",
  )
}
