package linthost

import "testing"

// TestCommandFormatPreservesMultilineTypeParamHeritage guards an interface
// whose type-parameter list breaks across lines while its `extends` clause
// stays on the `>` line. The members sit at the body depth and the closing
// `>`/heritage line must be preserved; format must not de-indent the body or
// disturb the heritage line.
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
