package linthost

import (
  "sort"
  "strings"
  "testing"
  "unicode/utf8"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUselessEscapeInvalidUtf8NamesReplacementCharacter verifies the
// no-useless-escape message when the escaped byte is not valid UTF-8.
//
// Source text reaches the rule as raw bytes, so an escape can target a byte
// that decodes to nothing — a lone 0xFF from a Latin-1 file saved without
// conversion. Naming the escaped rune must not smuggle that byte into the
// message: a Finding is serialized to JSON for the CLI renderer and the LSP,
// where an invalid sequence would be mangled downstream. Decoding yields
// U+FFFD, which is also what ESLint sees, because Node replaces undecodable
// bytes with U+FFFD while reading the file, long before the rule runs.
//
//  1. Lint a string and a regex whose escape targets a lone 0xFF byte.
//  2. Assert both messages name the replacement character.
//  3. Assert both messages are well-formed UTF-8 and still span one backslash.
func TestNoUselessEscapeInvalidUtf8NamesReplacementCharacter(t *testing.T) {
  source := "const bad = \"\\\xff\";\nconst pattern = /\\\xff/;\nJSON.stringify([bad, pattern]);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{
    "no-useless-escape": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  sort.Slice(findings, func(i, j int) bool { return findings[i].Pos < findings[j].Pos })
  if len(findings) != 2 {
    t.Fatalf("want 2 findings, got %d (%+v)", len(findings), findings)
  }
  const message = "Unnecessary escape character: \\\uFFFD."
  wanted := []int{
    strings.Index(source, "\\\xff"),
    strings.LastIndex(source, "\\\xff"),
  }
  for i, finding := range findings {
    if wanted[i] < 0 {
      t.Fatalf("[%d]: fixture lost its escape", i)
    }
    // Checked before the exact match so a regression that leaks the raw byte
    // back into the message is named as such instead of as a text mismatch.
    if !utf8.ValidString(finding.Message) {
      t.Fatalf("[%d]: message is not valid UTF-8: %x", i, finding.Message)
    }
    if finding.Message != message {
      t.Fatalf("[%d]: message mismatch:\nwant %q\ngot  %q", i, message, finding.Message)
    }
    if finding.Pos != wanted[i] || finding.End != wanted[i]+1 {
      t.Fatalf("[%d]: want range [%d,%d), got [%d,%d)",
        i, wanted[i], wanted[i]+1, finding.Pos, finding.End)
    }
  }
}
