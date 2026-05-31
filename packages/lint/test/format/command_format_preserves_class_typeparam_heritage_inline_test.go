package linthost

import "testing"

// TestCommandFormatPreservesClassTypeParamHeritageInline is a regression guard
// for the class counterpart to the interface case: when a class's
// type-parameter list breaks, Prettier keeps `extends` inline after `>`. The
// interface-specific own-line fix must not regress this.
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
