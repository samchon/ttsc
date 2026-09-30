package linthost

import (
  "encoding/json"
  "testing"
)

// TestInlineResolverCarriesOptionsInResolvedConfig protects the non-scoped
// compatibility path after Context binding moves to ResolvedRuleConfig.
//
// 1. Construct an eslint-alias rule with authored debugger options.
// 2. Resolve its severity and options for a virtual file.
// 3. Mutate the returned option bytes and require the original input to stay intact.
//
// @evidence contracts/testing.md#behavioral-verification InlineRuleResolver.ResolveRules normalizes the eslint alias with its severity and options, and mutating the resolved blob must not corrupt caller-owned options.
// @evidence contracts/testing.md#independent-expectations The authored DebuggerStatement option and error severity are independent contract inputs; the original raw JSON remaining unchanged is the aliasing oracle.
// @evidence contracts/testing.md#distinguishing-cases The alias resolves positively; changing the returned first byte is the mutation counterexample. The legacy custom resolver case separately owns the RuleOptions fallback.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored alias/options pair calls InlineRuleResolver.ResolveRules directly in-process; mutating returned bytes observes caller-state isolation without rule dispatch or a child evaluator.
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
