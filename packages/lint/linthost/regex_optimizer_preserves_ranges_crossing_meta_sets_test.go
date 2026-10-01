package linthost

import (
  "regexp"
  "strings"
  "testing"
)

// TestRegexOptimizerPreservesRangesCrossingMetaSets verifies that a range is
// redundant only when every character it contains belongs to the meta set.
//
// Both endpoints can belong to a complement while its interior does not, and
// positive word/space sets also contain gaps. Dropping such a range changes
// which characters the public better-regex rewrite accepts.
//
// 1. Optimize ranges crossing digit, word and whitespace set boundaries.
// 2. Compare original and optimized matching on the shared ASCII vocabulary.
// 3. Require genuinely contained ranges to shorten without changing matches.
//
// @evidence contracts/testing.md#behavioral-verification regexOptimizeLiteral runs the maintained optimizer on five crossing and three contained ranges; independently compiled original and returned patterns must agree on 127 ASCII characters, and contained controls must shorten.
// @evidence contracts/testing.md#independent-expectations Go's regexp matcher supplies an independent RE2 oracle for the tested one-character classes. Their ASCII digit/word/space meanings agree with ECMAScript except vertical tab, which is deliberately excluded; this oracle claims no Unicode or advanced-regexp equivalence.
// @evidence contracts/testing.md#distinguishing-cases Complement digit/word/space ranges and positive word/space gaps distinguish whole-range containment from endpoint membership; three contained controls prevent disabling all range optimization. Every other ASCII character except vertical tab is compared, including NUL and DEL.
// @evidence contracts/testing.md#execution-ownership This discoverable Go Test and its eight named subtests call the owning optimizer and ordinary independent regexp library in process. No consumer installation, native artifact build, JavaScript runtime or real product host is launched.
func TestRegexOptimizerPreservesRangesCrossingMetaSets(t *testing.T) {
  rows := []struct {
    name string
    literal string
    shorten bool
  }{
    {"complement-digits", `/[\D/-:]/`, false},
    {"complement-word", `/[\W@-\[]/`, false},
    {"complement-space", `/[\S\x08-\x0e]/`, false},
    {"positive-word-gap", `/[\w0-z]/`, false},
    {"positive-space-gap", "/[\\s -\u00a0]/", false},
    {"contained-complement", `/[\Da-f]/`, true},
    {"contained-word", `/[\wa-z]/`, true},
    {"contained-space", `/[\s\t-\r]/`, true},
  }
  for _, row := range rows {
    t.Run(row.name, func(t *testing.T) {
      output, err := regexOptimizeLiteral(row.literal, nil)
      if err != nil {
        t.Fatal(err)
      }
      if row.shorten && len(output) >= len(row.literal) {
        t.Errorf("contained range should still shorten: %q -> %q", row.literal, output)
      }
      original, err := regexp.Compile("^(?:" + strings.TrimSuffix(strings.TrimPrefix(row.literal, "/"), "/") + ")$")
      if err != nil {
        t.Fatal(err)
      }
      rewritten, err := regexp.Compile("^(?:" + strings.TrimSuffix(strings.TrimPrefix(output, "/"), "/") + ")$")
      if err != nil {
        t.Fatal(err)
      }
      for char := rune(0); char < 128; char++ {
        if char == 0x0b {
          continue
        }
        text := string(char)
        if original.MatchString(text) != rewritten.MatchString(text) {
          t.Errorf("%q -> %q changes matching U+%04X", row.literal, output, char)
        }
      }
    })
  }
}
