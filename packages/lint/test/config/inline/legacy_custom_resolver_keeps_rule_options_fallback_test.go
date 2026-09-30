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
//
// 1. Bind the legacy resolver carrying DebuggerStatement options.
// 2. Run the production engine over a debugger source.
// 3. Require exactly the expected forbidden-syntax diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver runs the actual no-restricted-syntax rule through a legacy resolver and must report exactly the forbidden debugger statement.
// @evidence contracts/testing.md#independent-expectations The authored selector DebuggerStatement and literal diagnostic follow the rule contract, rather than comparing two resolver-produced values.
// @evidence contracts/testing.md#distinguishing-cases A legacy resolver lacks the new resolved-options path and must still report; InlineResolverCarriesOptionsInResolvedConfig owns the new path and alias isolation.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. The authored legacy resolver reaches NewEngineWithResolver and a real parsed debugger source in-process; the exact rule diagnostic observes fallback without a config script or native contributor build.
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
