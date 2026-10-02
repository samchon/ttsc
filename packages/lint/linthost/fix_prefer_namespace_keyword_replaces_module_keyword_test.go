package linthost

import "testing"

// TestFixPreferNamespaceKeywordReplacesModuleKeyword verifies the
// preferNamespaceKeyword fixer swaps the legacy `module` keyword for
// `namespace`.
//
// The replacement grows module to namespace. Its original byte range must
// stay separate from the namespace name, exported member and later use.
// Comparing the complete rewritten source catches an incorrect anchor or
// length adjustment even when the desired keyword appears somewhere.
//
// 1. Parse a source file declaring `module Foo {}`.
// 2. Apply the finding through the disk-backed fixer.
// 3. Assert the keyword is now `namespace`.
//
// @evidence contracts/testing.md#behavioral-verification prefer-namespace-keyword replaces module with namespace while retaining Foo members and its use.
// @evidence contracts/testing.md#independent-expectations The literal namespace Foo result independently specifies the length-changing keyword edit and unchanged body.
// @evidence contracts/testing.md#distinguishing-cases Legacy module is the fixing arm; this case does not assert ambient string-module behavior.
// @evidence contracts/testing.md#execution-ownership TestFixPreferNamespaceKeywordReplacesModuleKeyword calls assertFixSnapshot with the actual namespace-keyword rule.
func TestFixPreferNamespaceKeywordReplacesModuleKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/prefer-namespace-keyword",
    "module Foo {\n  export const x = 1;\n}\nJSON.stringify(Foo.x);\n",
    "namespace Foo {\n  export const x = 1;\n}\nJSON.stringify(Foo.x);\n",
  )
}
