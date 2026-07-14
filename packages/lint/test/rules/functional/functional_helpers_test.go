package linthost

import (
  "encoding/json"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

func runFunctionalRule(t *testing.T, ruleName, source string) []*Finding {
  t.Helper()
  return runFunctionalRuleWithResolver(
    t,
    source,
    RuleConfig{ruleName: SeverityError},
    nil,
  )
}

func runFunctionalRuleWithOptions(t *testing.T, ruleName, source, optsJSON string) []*Finding {
  t.Helper()
  options := RuleOptionsMap{ruleName: json.RawMessage(optsJSON)}
  return runFunctionalRuleWithResolver(
    t,
    source,
    InlineRuleResolver{
      Rules:   RuleConfig{ruleName: SeverityError},
      Options: options,
    },
    options,
  )
}

func runFunctionalRuleWithResolver(
  t *testing.T,
  source string,
  resolver RuleResolver,
  options RuleOptionsMap,
) []*Finding {
  t.Helper()
  file := parseTSFile(t, "/virtual/functional.ts", source)
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  recordFindingBehavioralWitnessesByRule(t, findings, func(ruleName string) behavioralWitnessKind {
    return behavioralWitnessKindForOptions(ruleName, options)
  })
  return findings
}

func assertFunctionalFinding(t *testing.T, ruleName string, findings []*Finding, messagePart string) {
  t.Helper()
  if len(findings) != 1 {
    // Multi-finding regressions used to slip past the older
    // "at least one finding" check — a rule misfiring on every
    // identifier still passed. Require exactly one finding so
    // regressions surface immediately. Tests legitimately
    // expecting multiple findings should call a different helper.
    messages := make([]string, 0, len(findings))
    for _, finding := range findings {
      messages = append(messages, finding.Message)
    }
    t.Fatalf("%s: expected exactly one finding, got %d: %q", ruleName, len(findings), messages)
  }
  finding := findings[0]
  if finding.Rule != ruleName {
    t.Fatalf("want rule %q, got %q", ruleName, finding.Rule)
  }
  if len(finding.Fix) != 0 {
    t.Fatalf("%s: functional policy diagnostics must not offer autofixes", ruleName)
  }
  if messagePart != "" && !strings.Contains(finding.Message, messagePart) {
    t.Fatalf("%s: finding message %q does not contain %q", ruleName, finding.Message, messagePart)
  }
}

func assertNoFunctionalFinding(t *testing.T, ruleName string, findings []*Finding) {
  t.Helper()
  if len(findings) != 0 {
    t.Fatalf("%s: expected no findings, got %#v", ruleName, findings)
  }
}
