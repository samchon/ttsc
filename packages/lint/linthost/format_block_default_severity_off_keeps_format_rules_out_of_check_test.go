package linthost

import "testing"

// TestFormatBlockDefaultSeverityOffKeepsFormatRulesOutOfCheck verifies that
// an empty `format: {}` block keeps the six named formatter rules out of the
// enabled map and retains options for four of them.
//
// `format.severity` defaults to off while options remain available. These
// direct map observations do not execute check/build or format and do not
// enumerate every formatter's options.
//
//  1. Build an `ITtscLintConfig` object with `format: {}` only.
//  2. Parse it through `parseExternalConfigStore`.
//  3. Assert the six independently named rules are absent from the enabled map.
//  4. Assert semi, quotes, trailing-comma and print-width retain option blobs.
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore keeps semi, quotes, trailing-comma and print-width out of check diagnostics while retaining their options; sort-imports and jsdoc are not enabled for checks.
// @evidence contracts/testing.md#independent-expectations Default format severity is off even though formatting options remain available; independently selected public formatter names distinguish disabled diagnostics from missing options.
// @evidence contracts/testing.md#distinguishing-cases Owns an explicitly empty format object and separate diagnostic-versus-option observations; warning severity is the enabling counterpart.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored empty format object reaches parseExternalConfigStore in-process; EnabledRuleConfig and RuleOptions distinguish off diagnostics from retained payloads without running format or compiling a host.
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
      t.Errorf("expected %q to stay out of check diagnostics, got enabled", name)
    }
  }
}
