package linthost

import "testing"

// TestCommandFormatPreservesMultiTypeHeritageEmptyBody guards a heritage
// clause with two types whose inline form is exactly one column too wide once
// the empty body's `}` is counted. Prettier breaks each type onto its own
// line; declaration-header must charge the `}` of an empty body in its fit
// check so it does not keep the header inline one column over the limit.
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
