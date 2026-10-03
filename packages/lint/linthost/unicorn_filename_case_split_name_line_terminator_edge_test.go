package linthost

import (
  "strings"
  "testing"
)

// TestUnicornFilenameCaseSplitNameLineTerminatorEdge verifies the
// leading-underscore extraction's JavaScript regex parity on names containing
// line terminators.
//
// Upstream captures `/^(_+)(.*)$/` without the `s` or `m` flags, so a name
// with `\n`, `\r`, U+2028, or U+2029 after its underscores never matches
// and the underscores stay part of the checked words. Real filesystems rarely
// produce such names, but the helper must not silently diverge from the
// oracle on them.
//
// 1. Split conventional and line-terminator-bearing underscore names.
// 2. Assert leading extraction happens only for the conventional ones.
//
// @evidence contracts/testing.md#behavioral-verification The owning filename split helper evaluates ordinary and line-terminator-containing names and checks underscore extraction and retained word prefixes.
// @evidence contracts/testing.md#independent-expectations The supported change-case-compatible name policy and literal expected alternatives establish these unusual separators independently.
// @evidence contracts/testing.md#distinguishing-cases Line-terminator boundaries contrast with ordinary Unicode/path segments in complementary hosts.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseSplitNameLineTerminatorEdge owns its retained literal paths/options as a discoverable Go unit entry; the owning unicornFilenameCaseSplitName helper runs directly in the shared process on literal names, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseSplitNameLineTerminatorEdge(t *testing.T) {
  leading, words := unicornFilenameCaseSplitName("__fooBar")
  if leading != "__" || len(words) != 1 || words[0].word != "fooBar" {
    t.Fatalf("__fooBar: want leading __ + [fooBar], got %q %+v", leading, words)
  }
  for _, name := range []string{"_foo\nbar", "_foo\rbar", "_foo bar", "_foo bar"} {
    leading, words := unicornFilenameCaseSplitName(name)
    if leading != "" {
      t.Fatalf("%q: leading underscores must stay unextracted, got leading %q", name, leading)
    }
    if len(words) == 0 || !strings.HasPrefix(words[0].word, "_") {
      t.Fatalf("%q: first word must keep the underscore, got %+v", name, words)
    }
  }
}
