package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

func runTestingLibraryRules(t *testing.T, source string, rules RuleConfig) []ruleExpectation {
  t.Helper()
  return runTestingLibraryResolverWithOptions(
    t,
    source,
    rules,
    nil,
  )
}

func runTestingLibraryResolver(t *testing.T, source string, resolver InlineRuleResolver) []ruleExpectation {
  t.Helper()
  return runTestingLibraryResolverWithOptions(
    t,
    source,
    resolver,
    resolver.Options,
  )
}

func runTestingLibraryResolverWithOptions(
  t *testing.T,
  source string,
  resolver RuleResolver,
  options RuleOptionsMap,
) []ruleExpectation {
  t.Helper()
  file := parseTSXFile(t, "/virtual/component.test.tsx", source)
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  recordFindingBehavioralWitnessesByRule(t, findings, func(ruleName string) behavioralWitnessKind {
    return behavioralWitnessKindForOptions(ruleName, options)
  })
  return normalizeRuleFindings(file, findings)
}

func assertTestingLibraryFindings(t *testing.T, source string, rules RuleConfig, expected []ruleExpectation) {
  t.Helper()
  actual := runTestingLibraryRules(t, source, rules)
  assertTestingLibraryExpectedFindings(t, actual, expected)
}

func assertTestingLibraryFindingsWithResolver(t *testing.T, source string, resolver InlineRuleResolver, expected []ruleExpectation) {
  t.Helper()
  actual := runTestingLibraryResolver(t, source, resolver)
  assertTestingLibraryExpectedFindings(t, actual, expected)
}

func assertTestingLibraryExpectedFindings(t *testing.T, actual, expected []ruleExpectation) {
  t.Helper()
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
    }
  }
}
