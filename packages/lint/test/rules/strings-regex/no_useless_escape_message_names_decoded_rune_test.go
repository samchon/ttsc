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
// whole, while an escaped ASCII letter carrying a combining mark must still name
// the letter alone: the unit is one code point, not one grapheme cluster. The
// ASCII arm is the negative twin — a rune below 0x80 decodes to itself, so its
// message must stay byte-identical.
//
//  1. Lint escapes of a two-byte, three-byte, and astral rune plus an ASCII
//     letter, in both a string literal and a regex literal.
//  2. Add an escaped ASCII letter followed by a combining acute accent, whose
//     message must name the letter and stop there.
//  3. Enable only `no-useless-escape` and assert each message names the exact
//     character that follows the backslash.
func TestNoUselessEscapeMessageNamesDecodedRune(t *testing.T) {
  // The combining accent is written as an escape so no editor can silently
  // normalize the fixture into a precomposed single rune.
  source := "const stringCombining = \"\\e\u0301\";\n" + `const stringLatin = "\ä";
const stringWide = "\你";
const stringAstral = "\😀";
const stringAscii = "\a";
const regexLatin = /\ä/;
const regexWide = /\你/;
const regexAstral = /\😀/;
const regexAscii = /\a/;
JSON.stringify([stringCombining, stringLatin, stringWide, stringAstral, stringAscii]);
JSON.stringify([regexLatin, regexWide, regexAstral, regexAscii]);
`
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{
    "no-useless-escape": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  sort.Slice(findings, func(i, j int) bool { return findings[i].Pos < findings[j].Pos })
  expected := []string{
    "Unnecessary escape character: \\e.",
    "Unnecessary escape character: \\ä.",
    "Unnecessary escape character: \\你.",
    "Unnecessary escape character: \\😀.",
    "Unnecessary escape character: \\a.",
    "Unnecessary escape character: \\ä.",
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
