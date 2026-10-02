package linthost

import "testing"

// TestCommandFormatPreservesInterfaceQualifiedHeritageOwnLine guards the
// Prettier shape where a broken-type-parameter interface whose heritage type
// is a qualified name (`extends IPage.IRequest`) puts the `extends` clause on
// its own line. A bare-identifier heritage (see the inline guard) stays after
// `>`, so this case must be reproduced exactly, not collapsed inline.
//
//  1. Seed an interface with a broken type-parameter list and `extends IPage.IRequest` on its own line.
//  2. Run `ttsc format` with the default format block.
//  3. Require the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on an interface whose type-parameter list is broken and whose qualified `extends IPage.IRequest` clause sits on its own line after `>`, and requires the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The complete authored literal independently preserves constrained/defaulted parameters, qualified heritage on its own line and the optional member type; no independent Prettier invocation establishes these bytes.
// @evidence contracts/testing.md#distinguishing-cases One interface fixed point with qualified-name heritage; TestCommandFormatPreservesMultilineTypeParamHeritage owns the bare IBase interface variant, while TestCommandFormatPreservesClassTypeParamHeritageInline owns a class with generic Base<TKey> heritage. No collapsed input that must be re-broken is included here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatPreservesInterfaceQualifiedHeritageOwnLine(t *testing.T) {
  assertFormatUnchanged(t, `export interface IRequest<
  Search extends N.ISearch = N.ISearch,
  Sortable extends string = N.Columns,
>
  extends IPage.IRequest {
  search?: Search;
}
`)
}
