package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingChecksArrowLexicalEnvironment distinguishes inherited arrow captures from ordinary-function environments.
//
// JavaScript arrows inherit lexical this/arguments; ordinary functions establish their own environment, independently changing capture classification.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification The engine checks retained arrow value/this/arguments captures and ordinary-function counterparts.
// @evidence contracts/testing.md#independent-expectations JavaScript arrows inherit lexical this/arguments; ordinary functions establish their own environment, independently changing capture classification.
// @evidence contracts/testing.md#distinguishing-cases Arrow captures stay pinned while retained ordinary this/arguments and capture-free forms can report.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingChecksArrowLexicalEnvironment owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingChecksArrowLexicalEnvironment(t *testing.T) {
  source := `function outer(value: number): void {
  const movable = (input: number): number => input + 1;
  const capturesValue = (input: number): number => input + value;
  const capturesThis = (): unknown => this;
  const capturesArguments = (): IArguments => arguments;
  function ordinaryThis(): unknown { return this; }
  function ordinaryArguments(): IArguments { return arguments; }
  void [movable, capturesValue, capturesThis, capturesArguments, ordinaryThis, ordinaryArguments];
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, findings)
  if len(findings) != 3 {
    t.Fatalf("want movable arrow plus two ordinary functions, got %+v", findings)
  }
  messages := map[string]bool{}
  for _, finding := range findings {
    messages[finding.Message] = true
  }
  for _, message := range []string{
    "Move arrow function 'movable' to the outer scope.",
    "Move function 'ordinaryThis' to the outer scope.",
    "Move function 'ordinaryArguments' to the outer scope.",
  } {
    if !messages[message] {
      t.Fatalf("missing %q in %+v", message, findings)
    }
  }
}
