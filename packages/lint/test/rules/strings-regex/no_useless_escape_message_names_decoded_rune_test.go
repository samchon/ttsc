package linthost

import (
  "sort"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUselessEscapeMessageNamesDecodedRune verifies the no-useless-escape
// message names the escaped character itself, not its UTF-8 lead byte.
//
// Pins the issue-582 regression: both report sites built the message from
// `string(raw[i+1])`, a lone byte. For a multi-byte character that byte is the
// UTF-8 lead byte (`你` starts with 0xE4), and Go re-encodes it as the code
// point of the same numeric value (U+00E4 `ä`), so the diagnostic accused a
// character that never appeared in the source. ESLint canonical names the whole
// code point — the string arm reports `match[0].slice(1)` under a `/u` pattern,
// the regex arm `characterNode.raw.slice(1)` — so an astral rune must survive
// whole as well. The ASCII arm is the negative twin: its message must stay
// byte-identical, since a rune below 0x80 decodes to itself.
//
//  1. Lint a source that uselessly escapes a BMP rune, an astral rune, and an
//     ASCII letter, in both a string literal and a regex literal.
//  2. Enable only `no-useless-escape`.
//  3. Assert each message names the exact character that follows the backslash.
func TestNoUselessEscapeMessageNamesDecodedRune(t *testing.T) {
  source := `const stringWide = "\你";
const stringAstral = "\😀";
const stringAscii = "\a";
const regexWide = /\你/;
const regexAstral = /\😀/;
const regexAscii = /\a/;
JSON.stringify([stringWide, stringAstral, stringAscii, regexWide, regexAstral, regexAscii]);
`
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{
    "no-useless-escape": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  sort.Slice(findings, func(i, j int) bool { return findings[i].Pos < findings[j].Pos })
  expected := []string{
    "Unnecessary escape character: \\你.",
    "Unnecessary escape character: \\😀.",
    "Unnecessary escape character: \\a.",
    "Unnecessary escape character: \\你.",
    "Unnecessary escape character: \\😀.",
    "Unnecessary escape character: \\a.",
  }
  if len(findings) != len(expected) {
    t.Fatalf("want %d findings, got %d (%+v)", len(expected), len(findings), findings)
  }
  for i, message := range expected {
    if findings[i].Message != message {
      t.Fatalf("[%d]: message mismatch:\nwant %q\ngot  %q", i, message, findings[i].Message)
    }
  }
}
