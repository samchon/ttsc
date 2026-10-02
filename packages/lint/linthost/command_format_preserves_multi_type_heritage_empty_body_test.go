package linthost

import "testing"

// TestCommandFormatPreservesMultiTypeHeritageEmptyBody guards a heritage
// clause with two types whose inline form is exactly one column too wide once
// the empty body's `}` is counted. Declaration-header must charge the `}` in its fit
// check so it does not keep the header inline one column over the limit.
//
//  1. Seed a nested-namespace interface with an exploded two-type `extends` clause and an empty body.
//  2. Run `ttsc format` with the default format block.
//  3. Require the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on a nested-namespace interface whose two-type `extends` clause is already exploded one type per line with an empty `{}` body, and requires the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The complete authored literal preserves both heritage type names, nested namespaces and the empty interface. Its inline continuation candidate is 81 columns with `}` and 80 without it, independently of formatter output; no independent Prettier invocation establishes the source bytes.
// @evidence contracts/testing.md#distinguishing-cases One fixed point at the 80/81-column empty-body boundary: omitting `}` from the candidate width would wrongly collapse its clause. There is no flat-to-broken input, under-width twin or nonempty-body contrast in this entry.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatPreservesMultiTypeHeritageEmptyBody(t *testing.T) {
  assertFormatUnchanged(t, `export namespace IShoppingSaleReview {
  export namespace IRequest {
    export interface ISearch
      extends
        IShoppingSaleInquiry.IRequest.ISearch,
        IInvertSearch.IScoreRange {}
  }
}
`)
}
