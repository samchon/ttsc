package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type legacyCustomRuleOptionsResolver struct {
  InlineRuleResolver
}

// ResolveRules deliberately returns the pre-file-options shape. Embedding
// InlineRuleResolver supplies every other RuleResolver method, including the
// legacy file-agnostic RuleOptions lookup.
func (r legacyCustomRuleOptionsResolver) ResolveRules(string) ResolvedRuleConfig {
  return ResolvedRuleConfig{Rules: normalizeRuleConfigKeys(r.Rules)}
}

// TestLegacyCustomResolverKeepsRuleOptionsFallback protects external resolver
// compatibility while built-in scoped resolvers move to authoritative
// per-file options.
func TestLegacyCustomResolverKeepsRuleOptionsFallback(t *testing.T) {
  resolver := legacyCustomRuleOptionsResolver{InlineRuleResolver: InlineRuleResolver{
    Rules: RuleConfig{"no-restricted-syntax": SeverityError},
    Options: RuleOptionsMap{
      "no-restricted-syntax": json.RawMessage(`"DebuggerStatement"`),
    },
  }}
  file := parseTS(t, "debugger;\n")
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 || findings[0].Message != "Using 'DebuggerStatement' is not allowed." {
    t.Fatalf("legacy RuleOptions fallback was not preserved: %+v", findings)
  }
}
