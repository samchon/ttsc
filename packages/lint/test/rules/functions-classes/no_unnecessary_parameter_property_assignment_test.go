package linthost

import "testing"

// TestRuleCorpusNoUnnecessaryParameterPropertyAssignment verifies the lint rule corpus fixture no-unnecessary-parameter-property-assignment.ts.
//
// Parameter properties already emit constructor initialization before the body.
// A same-name `this.x = x` body assignment repeats that generated work, while
// later assignments after a real mutation must be left alone.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares both redundant public/private parameter-property assignments while preserving ordinary parameters and intervening mutation.
// @evidence contracts/testing.md#independent-expectations TypeScript parameter properties initialize the instance before the constructor body; original authored annotations distinguish repeating that value from actual changes.
// @evidence contracts/testing.md#distinguishing-cases Repeated value/count copies report; the normal parameter assignment and value.trim followed by restoration remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnnecessaryParameterPropertyAssignment is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-unnecessary-parameter-property-assignment.ts through the owning Engine. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoUnnecessaryParameterPropertyAssignment(t *testing.T) {
  assertRuleCorpusCase(t, "no-unnecessary-parameter-property-assignment.ts", `class Repeated {
  constructor(
    public value: string,
    private readonly count: number,
    normal: string,
  ) {
    // expect: typescript/no-unnecessary-parameter-property-assignment error
    this.value = value;
    // expect: typescript/no-unnecessary-parameter-property-assignment error
    this.count = count;
    this.normal = normal;
  }
}

class ChangedFirst {
  constructor(public value: string) {
    this.value = value.trim();
    this.value = value;
  }
}

JSON.stringify([Repeated, ChangedFirst]);
`)
}
