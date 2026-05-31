package linthost

import "testing"

// TestCommandFormatPreservesInterfaceQualifiedHeritageOwnLine guards the
// Prettier shape where a broken-type-parameter interface whose heritage type
// is a qualified name (`extends IPage.IRequest`) puts the `extends` clause on
// its own line. A bare-identifier heritage (see the inline guard) stays after
// `>`, so this case must be reproduced exactly, not collapsed inline.
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
