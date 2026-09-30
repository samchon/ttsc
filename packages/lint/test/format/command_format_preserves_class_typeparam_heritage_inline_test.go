package linthost

import "testing"

// TestCommandFormatPreservesClassTypeParamHeritageInline is a regression guard
// for the class counterpart to the interface case: when a class's
// type-parameter list breaks, Prettier keeps `extends` inline after `>`. The
// interface-specific own-line fix must not regress this.
//
//  1. Exercise the authored command format preserves class typeparam heritage inline fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises preserves class typeparam heritage inline and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for a regression guard for the class counterpart to the interface case: when a class's type-parameter list breaks, Prettier keeps `extends` inline after `>`. The interface-specific own-line fix must not regress this. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatPreservesClassTypeParamHeritageInline owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatPreservesClassTypeParamHeritageInline(t *testing.T) {
  assertFormatUnchanged(t, `declare class Base<T> {}
export class C<
  TKey extends string = string,
  TVal extends string = string,
> extends Base<TKey> {
  x = 1;
}
`)
}
