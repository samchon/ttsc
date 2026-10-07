package linthost

import "testing"

// TestNoUselessEscapeVFlagClassPreservesSyntaxCharEscapes verifies the rule
// leaves ClassSetSyntaxCharacter escapes inside a `v`-flag regex character
// class untouched.
//
// Pins issue #607: the in-class allowlist was flag-blind, so the autofix
// deleted the load-bearing backslash in `/[\(]/v`, producing `/[(]/v` — a
// `SyntaxError: Invalid character in character class`. In `v` (unicodeSets)
// mode `( ) [ ] { } / | -` stay meaningful inside `[...]`, so their escapes are
// required; ESLint switches to REGEX_CLASSSET_CHARACTER_ESCAPES on that flag.
// The negative twins prove the fix stayed narrow: a `u`-flag class still strips
// `\(` (a bare `(` is legal there), and the raw `v`-mode token
// (`\a`) is still reported and edited rather than blanket-skipped. That token
// is not valid ECMAScript Unicode-mode identity-escape syntax; this control
// exercises the lint edit policy without certifying regex admission or meaning.
//
//  1. Assert the seven authored ClassSetSyntaxCharacter escapes in `v` report
//     nothing (no finding, no corrupting fix).
//  2. Assert the `u`-flag twin still fixes `/[\(]/u` to `/[(]/u`.
//  3. Assert the malformed raw `/[\a]/v` control still edits to `/[a]/v`.
//
// @evidence contracts/testing.md#behavioral-verification Seven Unicode-set syntax-character tokens produce no findings; the u-paren and malformed raw v-a controls apply edits and compare complete literal output bytes.
// @evidence contracts/testing.md#independent-expectations ECMAScript v class grammar requires the seven punctuation escapes; independently authored u/v output bytes pin the edit policy. The v-a input is not a grammar-valid identity escape, and this body does not certify admission or runtime equivalence.
// @evidence contracts/testing.md#distinguishing-cases Seven retained escapes, the legal u-paren control and malformed raw v-a edit control distinguish flag-sensitive retention from a blanket v-mode exemption.
// @evidence contracts/testing.md#execution-ownership This Test registers the seven retained characters and two fixer controls with t.Run; assertRuleSkipsSource owns allowance and assertFixSnapshot applies the actual edits against independently authored output. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestNoUselessEscapeVFlagClassPreservesSyntaxCharEscapes(t *testing.T) {
  // `( ) [ { } | /` gain meaning only through the `v` flag; `]` and `-` are
  // meaningful in any character class and are covered by the base allowlist.
  for _, ch := range []string{"(", ")", "[", "{", "}", "|", "/"} {
    source := "const re = /[\\" + ch + "]/v;\n"
    t.Run("v-flag keeps \\"+ch, func(t *testing.T) {
      assertRuleSkipsSource(t, "no-useless-escape", source)
    })
  }

  // u-mode: `(` in a character class is legal, so the escape is still useless
  // and the fix must still strip it.
  t.Run("u-flag class still strips redundant paren escape", func(t *testing.T) {
    assertFixSnapshot(
      t,
      "no-useless-escape",
      "const re = /[\\(]/u;\n",
      "const re = /[(]/u;\n",
    )
  })

  // v-mode is not a blanket skip: the raw `\a` token is still reported
  // and edited; its input grammar validity is not asserted.
  t.Run("v-flag class still strips a genuinely useless escape", func(t *testing.T) {
    assertFixSnapshot(
      t,
      "no-useless-escape",
      "const re = /[\\a]/v;\n",
      "const re = /[a]/v;\n",
    )
  })
}
