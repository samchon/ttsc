package linthost

import "testing"

// TestRegexOptimizerDistinguishesAZeroUpperBoundFromAnOpenRange verifies explicit zero remains finite.
//
// Range presence is separate from its numeric value. Losing a zero upper bound
// turns an empty-only match into unbounded consumption and corrupts repetition merging.
//
// 1. Optimize closed-zero, open, merged, lazy and ordinary ranges.
// 2. Compare literal output with independently authored repetition bounds.
// 3. Check range extraction, greediness and increment keep zero presence.
//
// @evidence contracts/testing.md#behavioral-verification The owning optimizer and range helpers retain finite zero while ordinary open ranges shorten.
// @evidence contracts/testing.md#independent-expectations A closed zero repetition consumes nothing; adding one makes exactly one, whereas an absent upper bound remains unbounded.
// @evidence contracts/testing.md#distinguishing-cases Closed zero/zero-zero, lazy zero, adjacent repetition, open zero and positive one exercise the optimizer; direct assertions additionally check extraction, open-range classification and increment.
// @evidence contracts/testing.md#execution-ownership This direct Go source unit calls the maintained optimizer and helpers without a producer process.
func TestRegexOptimizerDistinguishesAZeroUpperBoundFromAnOpenRange(t *testing.T) {
  for _, pair := range [][2]string{
    {"/a{0}/", "/a{0}/"},
    {"/a{0,0}/", "/a{0}/"},
    {"/a{0}?/", "/a{0}?/"},
    {"/a{0}a/", "/a/"},
    {"/a{0}a{0}/", "/a{0}/"},
    {"/a{0,}/", "/a*/"},
    {"/a{1}/", "/a/"},
  } {
    t.Run(pair[0], func(t *testing.T) {
      got, err := regexOptimizeLiteral(pair[0], nil)
      if err != nil || got != pair[1] {
        t.Fatalf("optimize %s: got %q, error %v; want %q", pair[0], got, err, pair[1])
      }
    })
  }
  q := &regexQuantifierNode{Kind: "Range", From: 0, To: 0, HasTo: true, Greedy: true, FieldOrder: "ft"}
  from, to, finite := regexExtractFromTo(q)
  if from != 0 || to != 0 || !finite || regexIsGreedyOpenRange(q) {
    t.Fatalf("closed zero lost its finite bound: %+v", q)
  }
  regexIncreaseQuantifierByOne(q)
  if q.From != 1 || q.To != 1 || !q.HasTo {
    t.Fatalf("increment must yield exactly one: %+v", q)
  }
}
