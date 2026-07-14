package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornStringContentTreatsPatternAsRegularExpression verifies pattern
// keys compile as regular expressions, not literal substrings.
//
// Upstream feeds each key to `new RegExp(...)`, so an unescaped `.` matches
// every character while `\.` matches only the dot — the upstream suite's
// escaped-pattern pair. The diagnostic message must echo the pattern SOURCE
// (`\.`), not the matched text, because that is what the user configured.
//
//  1. Fix `"foo.bar"` under the unescaped `.` pattern and assert every
//     character is replaced.
//  2. Fix the same source under the escaped `\.` pattern and assert only
//     the dot is replaced.
//  3. Assert the escaped pattern's message interpolates the `\.` source.
//  4. Fix an astral-emoji subject under `.` and an astral pattern key,
//     pinning the `u`-flag code-point (not code-unit) matching model.
func TestUnicornStringContentTreatsPatternAsRegularExpression(t *testing.T) {
  source := `const foo = "foo.bar";` + "\n"

  t.Run("unescaped dot matches everything", func(t *testing.T) {
    assertFixSnapshotWithOptions(
      t,
      "unicorn/string-content",
      source,
      `{"patterns":{".":"_"}}`,
      `const foo = "_______";`+"\n",
    )
  })

  t.Run("escaped dot matches only the dot", func(t *testing.T) {
    options := `{"patterns":{"\\.":"_"}}`
    assertFixSnapshotWithOptions(
      t,
      "unicorn/string-content",
      source,
      options,
      `const foo = "foo_bar";`+"\n",
    )
    _, _, findings := runRuleFindingsSnapshot(t, "unicorn/string-content", source, json.RawMessage(options))
    if len(findings) != 1 || findings[0].Message != "Prefer `_` over `\\.`." {
      t.Fatalf("message must echo the configured pattern source, got %+v", findings)
    }
  })

  t.Run("dot consumes a whole astral code point", func(t *testing.T) {
    // Upstream compiles with the `u` flag, so `.` consumes 🦄 as ONE unit;
    // a code-unit engine would emit two replacement characters instead.
    assertFixSnapshotWithOptions(
      t,
      "unicorn/string-content",
      `const foo = "🦄";`+"\n",
      `{"patterns":{".":"_"}}`,
      `const foo = "_";`+"\n",
    )
  })

  t.Run("astral pattern key matches astral text", func(t *testing.T) {
    assertFixSnapshotWithOptions(
      t,
      "unicorn/string-content",
      `const foo = "a 🦄 b";`+"\n",
      `{"patterns":{"🦄":"🐴"}}`,
      `const foo = "a 🐴 b";`+"\n",
    )
  })
}
