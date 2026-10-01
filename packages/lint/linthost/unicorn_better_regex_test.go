package linthost

import "testing"

const unicornBetterRegexRuleName = "unicorn/better-regex"

// TestUnicornBetterRegex verifies the rule rewrites regex literals into the
// shortest equivalent form the upstream regexp-tree optimizer produces.
//
// Each pair is an upstream `better-regex` invalid case: a mangled or
// unoptimized literal on the left, the canonical literal upstream emits on the
// right. Asserting the fixed source (input differs from output) pins the
// transformation direction — character-class-to-meta (`[0-9]` -> `\d`), word
// shorthands, negations, flag sorting, whitespace collapse, class sorting, and
// quantifier merges — not merely that a canonical form round-trips.
//
//  1. Lint each declaration through the native fix applier.
//  2. Assert the rewritten source equals the upstream-optimized literal.
//
// @evidence contracts/testing.md#behavioral-verification assertFixSnapshot verifies fifteen literal regex rewrites, including digit/word complements, flag order, class sorting, whitespace quantifiers and the single-character class escape.
// @evidence contracts/testing.md#independent-expectations Each input/output pair is an independently authored upstream better-regex invalid corpus pair, so exact full-source equality catches unsound token changes.
// @evidence contracts/testing.md#distinguishing-cases Positive pairs retain surrounding declaration text; the negated [^*] class stays a class while [*] becomes an escaped literal. TestUnicornBetterRegexLeavesOptimalLiterals owns the adjacent canonical no-finding corpus.
// @evidence contracts/testing.md#execution-ownership The table loops in this Go unit entry; failures retain the input/output fixture printed by assertFixSnapshot; the shared Go process runs owning operations without installing a consumer, building a native artifact or launching a product host.
func TestUnicornBetterRegex(t *testing.T) {
  cases := []struct{ input, output string }{
    {"const foo = /[0-9]/;\n", "const foo = /\\d/;\n"},
    {"const foo = /[^0-9]/;\n", "const foo = /\\D/;\n"},
    {"const foo = /\\w/ig;\n", "const foo = /\\w/gi;\n"},
    {"const foo = /[A-Za-z0-9_]/;\n", "const foo = /\\w/;\n"},
    {"const foo = /[A-Za-z\\d_]/;\n", "const foo = /\\w/;\n"},
    {"const foo = /[^A-Za-z0-9_]/;\n", "const foo = /\\W/;\n"},
    {"const foo = /[a-z0-9_]/i;\n", "const foo = /\\w/i;\n"},
    {"const foo = /[^a-z\\d_]/ig;\n", "const foo = /\\W/gi;\n"},
    {"const foo = /[a-z0-9_]/;\n", "const foo = /[\\d_a-z]/;\n"},
    {"const foo = /[A-Za-z0-9_]+[0-9]?\\.[A-Za-z0-9_]*/;\n", "const foo = /\\w+\\d?\\.\\w*/;\n"},
    {"const foo = /^by @([a-zA-Z0-9-]+)/;\n", "const foo = /^by @([\\dA-Za-z-]+)/;\n"},
    {"const foo = /^[a-z][a-z0-9\\-]{5,29}$/;\n", "const foo = /^[a-z][\\da-z\\-]{5,29}$/;\n"},
    {"const foo = /\\s?\\s?\\s?/;\n", "const foo = /\\s{0,3}/;\n"},
    {"const foo = /[GgHhIiå.Z:a-f\"0-8%A*ä]/;\n", "const foo = /[\"%*.0-8:AG-IZa-iäå]/;\n"},
    // Single-char class collapses to the escaped char; the adjacent negated
    // single-char class `[^*]` is the negative twin — it must stay a class.
    {"const foo = /^[^*]*[*]?$/;\n", "const foo = /^[^*]*\\*?$/;\n"},
  }
  for _, tc := range cases {
    assertFixSnapshot(t, unicornBetterRegexRuleName, tc.input, tc.output)
  }
}
