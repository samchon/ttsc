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
// `\(` (a bare `(` is legal there), and a genuinely useless `v`-mode escape
// (`\a`) is still reported and removed rather than blanket-skipped.
//
//  1. Assert every ClassSetSyntaxCharacter escape in a `v`-flag class reports
//     nothing (no finding, no corrupting fix).
//  2. Assert the `u`-flag twin still fixes `/[\(]/u` to `/[(]/u`.
//  3. Assert a useless `v`-mode escape `/[\a]/v` still fixes to `/[a]/v`.
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

  // v-mode is not a blanket skip: an escape that is useless even under
  // unicodeSets (`\a`) is still reported and removed.
  t.Run("v-flag class still strips a genuinely useless escape", func(t *testing.T) {
    assertFixSnapshot(
      t,
      "no-useless-escape",
      "const re = /[\\a]/v;\n",
      "const re = /[a]/v;\n",
    )
  })
}
