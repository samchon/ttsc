package linthost

import "testing"

// TestCommandFormatPreservesMultiTypeHeritageEmptyBody guards a heritage
// clause with two types whose inline form is exactly one column too wide once
// the empty body's `}` is counted. Prettier breaks each type onto its own
// line; declaration-header must charge the `}` of an empty body in its fit
// check so it does not keep the header inline one column over the limit.
//
//  1. Seed a nested-namespace interface with an exploded two-type `extends` clause and an empty body.
//  2. Run `ttsc format` with the default format block.
//  3. Require the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on a nested-namespace interface whose two-type `extends` clause is already exploded one type per line with an empty `{}` body, and requires the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The source is an authored literal in the Prettier layout and is its own expected output.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case. Because the input is already broken, it does not itself exercise the one-column-too-wide flat form the comment describes; that overflow-from-flat direction is covered by the declaration-header break tests.
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
