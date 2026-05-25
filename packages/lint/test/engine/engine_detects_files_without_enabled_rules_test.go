package linthost

import "testing"

// TestEngineDetectsFilesWithoutEnabledRules verifies file-level rule maps with
// no active severities are treated as empty.
//
// Glob-scoped lint configs can include files through tsconfig while applying no
// rules to those files. The engine uses this predicate before walking the AST,
// so off-only maps must behave the same as omitted rules and non-off severities
// must keep the file eligible for rule dispatch.
//
// 1. Check nil, empty, and off-only rule maps.
// 2. Check warning and error maps.
// 3. Assert only warning and error maps are considered enabled.
func TestEngineDetectsFilesWithoutEnabledRules(t *testing.T) {
  cases := []struct {
    name  string
    rules RuleConfig
    want  bool
  }{
    {name: "nil", rules: nil, want: false},
    {name: "empty", rules: RuleConfig{}, want: false},
    {name: "off", rules: RuleConfig{"no-var": SeverityOff}, want: false},
    {name: "warning", rules: RuleConfig{"no-var": SeverityWarn}, want: true},
    {name: "error", rules: RuleConfig{"no-var": SeverityError}, want: true},
  }

  for _, tt := range cases {
    if got := hasEnabledFileRules(tt.rules); got != tt.want {
      t.Fatalf("%s: want %v, got %v", tt.name, tt.want, got)
    }
  }
}
