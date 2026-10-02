package linthost

import "testing"

// TestCommandFormatPreservesMultilineTypeParamHeritage guards an interface
// whose type-parameter list breaks across lines while its `extends` clause
// stays on the `>` line. The members sit at the body depth and the closing
// `>`/heritage line must be preserved; format must not de-indent the body or
// disturb the heritage line.
//
//  1. Seed an interface with a broken type-parameter list and `> extends IBase {` on the closing line.
//  2. Run `ttsc format` with the default format block.
//  3. Require the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on an interface whose type-parameter list is broken one per line and whose `> extends IBase {` stays on the closing line, and requires the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The source is an authored literal in the Prettier layout (bare-identifier heritage inline after `>`) and is its own expected output.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case guarding the body depth and the heritage line against de-indentation; the qualified-heritage variant that moves to its own line is owned by a separate test.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatPreservesMultilineTypeParamHeritage(t *testing.T) {
  assertFormatUnchanged(t, `interface IBase {
  id: string;
}
export interface IRequest<
  Search extends string = string,
  Sortable extends string = string,
> extends IBase {
  search?: Search;
}
`)
}
