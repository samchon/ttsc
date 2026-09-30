package linthost

import "testing"

// TestCommandFormatPreservesInterfaceQualifiedHeritageOwnLine guards the
// Prettier shape where a broken-type-parameter interface whose heritage type
// is a qualified name (`extends IPage.IRequest`) puts the `extends` clause on
// its own line. A bare-identifier heritage (see the inline guard) stays after
// `>`, so this case must be reproduced exactly, not collapsed inline.
//
//  1. Exercise the authored command format preserves interface qualified heritage own line fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises preserves interface qualified heritage own line and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for the Prettier shape where a broken-type-parameter interface whose heritage type is a qualified name (`extends IPage.IRequest`) puts the `extends` clause on its own line. A bare-identifier heritage (see the inline guard) stays after `>`, so this case must be reproduced exactly, not collapsed inline. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatPreservesInterfaceQualifiedHeritageOwnLine owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
