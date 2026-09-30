package linthost

import "testing"

// TestCommandFormatPreservesMultilineTypeParamHeritage guards an interface
// whose type-parameter list breaks across lines while its `extends` clause
// stays on the `>` line. The members sit at the body depth and the closing
// `>`/heritage line must be preserved; format must not de-indent the body or
// disturb the heritage line.
//
//  1. Exercise the authored command format preserves multiline type param heritage fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises preserves multiline type param heritage and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for an interface whose type-parameter list breaks across lines while its `extends` clause stays on the `>` line. The members sit at the body depth and the closing `>`/heritage line must be preserved; format must not de-indent the body or disturb the heritage line. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatPreservesMultilineTypeParamHeritage owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
