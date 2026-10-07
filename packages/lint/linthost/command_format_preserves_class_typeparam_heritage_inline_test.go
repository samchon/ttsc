package linthost

import "testing"

// TestCommandFormatPreservesClassTypeParamHeritageInline is a regression guard
// for the class counterpart to the interface case: when a class's
// type-parameter list breaks, Prettier keeps `extends` inline after `>`. The
// interface-specific own-line fix must not regress this.
//
//  1. Seed a class whose type-parameter list is broken one per line and whose
//     `> extends Base<TKey> {` stays on the closing line.
//  2. Run `ttsc format` and require the file to stay byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on a class whose type-parameter list is broken one per line and whose `> extends Base<TKey> {` stays on the closing line, and requires the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The complete authored literal independently preserves both constrained/defaulted type parameters, inline heritage after `>` and the class field. No independent Prettier invocation establishes the expected bytes.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case guarding the class path against the interface-specific own-line heritage rule. The interface twin is owned by the interface-heritage tests; no flat input that must change is included.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
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
