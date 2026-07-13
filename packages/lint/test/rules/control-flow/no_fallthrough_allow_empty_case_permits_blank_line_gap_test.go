package linthost

import "testing"

// TestNoFallthroughAllowEmptyCasePermitsBlankLineGap verifies the allowEmptyCase option through the typed options transport.
//
// The same blank-line-separated empty case that reports under the defaults
// must pass when `allowEmptyCase: true` arrives via the rule's options blob.
// Locks both the option's semantics and its JSON decoding.
//
// 1. Reuse the blank-line empty-case source that reports by default.
// 2. Run the engine with options {"allowEmptyCase":true}.
// 3. Assert zero findings.
func TestNoFallthroughAllowEmptyCasePermitsBlankLineGap(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:

  case 1:
    console.log(1);
    break;
}
`, `{"allowEmptyCase":true}`)
}
