package linthost

import "testing"

// TestFormatBlockDefaultSeverityOffKeepsFormatRulesOutOfCheck verifies that
// declaring an empty `format: {}` block does not turn formatting into a
// check/build diagnostic policy.
//
// The block still materializes per-rule options so `ttsc format` can use
// Prettier-aligned defaults, but `format.severity` defaults to off. A
// regression that reports format findings during check by default would make
// formatting a compile policy again.
//
//  1. Build an `ITtscLintConfig` object with `format: {}` only.
//  2. Parse it through `parseExternalConfigStore`.
//  3. Assert no `format/*` rules are enabled for check/build.
//  4. Assert always-on format rules still have option blobs for format mode.
func TestFormatBlockDefaultSeverityOffKeepsFormatRulesOutOfCheck(t *testing.T) {
  resolver, err := parseExternalConfigStore(map[string]any{
    "format": map[string]any{},
  }, "")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }
  enabled := resolver.EnabledRuleConfig()
  for _, name := range []string{
    "format/semi",
    "format/quotes",
    "format/trailing-comma",
    "format/print-width",
  } {
    if _, ok := enabled[name]; ok {
      t.Errorf("expected %q to stay out of check diagnostics, got %v", name, enabled[name])
    }
    if options := resolver.RuleOptions(name); len(options) == 0 {
      t.Errorf("expected %q options to be available for format mode", name)
    }
  }
  for _, name := range []string{"format/sort-imports", "format/jsdoc"} {
    if _, ok := enabled[name]; ok {
      t.Errorf("expected %q to stay off (opt-in), got enabled", name)
    }
  }
}
