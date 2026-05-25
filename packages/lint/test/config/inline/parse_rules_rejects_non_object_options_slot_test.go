package linthost

import (
  "strings"
  "testing"
)

// TestParseRulesRejectsNonObjectOptionsSlot verifies non-object
// options-slot rejection.
//
// ESLint accepts string-typed positional options as a shorthand (e.g.
// `["error", "single"]` for the `quotes` rule). ttsc does not: every
// option struct in TtscLintRuleOptions is an object, so silently
// encoding a non-object slot would land in DecodeOptions as a decode
// error that every rule discards. The parser fails loudly instead so
// users discover the proper `["error", { … }]` form. This scenario
// pins the rejection for both the ESLint-shorthand case and the
// empty-array case.
//
// 1. Build inline rule entries with string and array options.
// 2. Parse each through ParseRulesWithOptions.
// 3. Assert each surfaces the documented "must be an object" error.
func TestParseRulesRejectsNonObjectOptionsSlot(t *testing.T) {
  cases := []struct {
    name  string
    entry any
  }{
    {"string shorthand", []any{"error", "single"}},
    {"empty array", []any{"warning", []any{}}},
    {"number", []any{"warning", 42}},
  }
  for _, c := range cases {
    _, _, err := ParseRulesWithOptions(map[string]any{
      "formatQuotes": c.entry,
    })
    if err == nil {
      t.Errorf("%s: expected rejection, got nil", c.name)
      continue
    }
    if !strings.Contains(err.Error(), "options slot must be an object") {
      t.Errorf("%s: error should point at object requirement, got %v", c.name, err)
    }
  }
}
