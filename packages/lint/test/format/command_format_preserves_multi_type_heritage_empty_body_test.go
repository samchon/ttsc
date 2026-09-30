package linthost

import "testing"

// TestCommandFormatPreservesMultiTypeHeritageEmptyBody guards a heritage
// clause with two types whose inline form is exactly one column too wide once
// the empty body's `}` is counted. Prettier breaks each type onto its own
// line; declaration-header must charge the `}` of an empty body in its fit
// check so it does not keep the header inline one column over the limit.
//
//  1. Exercise the authored command format preserves multi type heritage empty body fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises preserves multi type heritage empty body and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for a heritage clause with two types whose inline form is exactly one column too wide once the empty body's `}` is counted. Prettier breaks each type onto its own line; declaration-header must charge the `}` of an empty body in its fit check so it does not keep the header inline one column over the limit. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatPreservesMultiTypeHeritageEmptyBody owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
