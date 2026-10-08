package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteSkipsNonASCIIIdentifierPrefix Verifies executable root
// identity rejects larger Unicode identifiers while accepting a bare target.
//
// ASCII, BMP and astral prefixes belong to distinct identifier tokens. The
// direct output owner must report the registered target absent instead of
// returning corrupt output, while a bare positive call receives its replacement.
//
// 1. Supply calls on roots containing the requested root as a trailing substring.
// 2. Cover ASCII, BMP and astral identifier prefixes and require missing-call errors.
// 3. Contrast a bare target call that emits the literal replacement and marker.
//
// @evidence contracts/testing.md#behavioral-verification applyRewrites rejects each larger identifier with a missing-call error and no output; a bare typia.assert call receives the replacement and actual header marker.
// @evidence contracts/testing.md#independent-expectations A substring of a larger identifier is not the registered root. Literal missing-call errors and positive marker/replacement requirements distinguish token identity without computing expectations through another scanner.
// @evidence contracts/testing.md#distinguishing-cases ASCII, two BMP and astral prefixes reject mid-identifier matches, contrasted with a bare positive target; the public runtime case also preserves a neighboring executable Unicode root and property chain.
// @evidence contracts/testing.md#execution-ownership This Go unit directly exercises the actual output-rewrite owner with a parsed filename identity and authored emitted text through rewriteTextForTest, without a compiler host or installed consumer.
func TestDriverRewriteSkipsNonASCIIIdentifierPrefix(t *testing.T) {
  rewrite := driver.Rewrite{
    RootName:      "typia",
    Method:        "assert",
    Replacement:   "__REPLACED__",
    ConsumeParens: true,
  }
  for _, prefix := range []string{"my", "é", "한", "𝒜"} {
    text := "const x = " + prefix + "typia.assert(input);"
    got, err := rewriteTextForTest(text, rewrite)
    if got != "" || err == nil || !strings.Contains(err.Error(), "could not locate") {
      t.Fatalf("prefix %q: expected no output and a missing-call error; got=%q err=%v", prefix, got, err)
    }
  }

  positive := "const x = typia.assert(input);"
  got, err := rewriteTextForTest(positive, rewrite)
  if err != nil {
    t.Fatalf("positive control: unexpected error: %v", err)
  }
  if !strings.HasPrefix(got, driver.RewriteSentinel+"\n") || !strings.Contains(got, "__REPLACED__") || strings.Contains(got, "typia.assert") {
    t.Fatalf("positive control: call was not replaced:\n%s", got)
  }
}
