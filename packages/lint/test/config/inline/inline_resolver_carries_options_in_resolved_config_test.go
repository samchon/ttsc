package linthost

import (
  "encoding/json"
  "testing"
)

// TestInlineResolverCarriesOptionsInResolvedConfig protects the non-scoped
// compatibility path after Context binding moves to ResolvedRuleConfig.
func TestInlineResolverCarriesOptionsInResolvedConfig(t *testing.T) {
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"eslint/no-restricted-syntax": SeverityError},
    Options: RuleOptionsMap{
      "eslint/no-restricted-syntax": json.RawMessage(`"DebuggerStatement"`),
    },
  }
  resolved := resolver.ResolveRules("/virtual/file.ts")
  if resolved.Rules.Severity("no-restricted-syntax") != SeverityError ||
    string(resolved.RuleOptions("no-restricted-syntax")) != `"DebuggerStatement"` {
    t.Fatalf("inline options were not normalized with severity: %+v options=%s", resolved, resolved.RuleOptions("no-restricted-syntax"))
  }

  resolved.Options["no-restricted-syntax"][0] = 'x'
  if string(resolver.Options["eslint/no-restricted-syntax"]) != `"DebuggerStatement"` {
    t.Fatalf("resolved inline options alias caller-owned input: %s", resolver.Options["eslint/no-restricted-syntax"])
  }
}
