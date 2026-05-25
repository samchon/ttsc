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
func TestRuleCorpusNoUnnecessaryParameterPropertyAssignment(t *testing.T) {
  assertRuleCorpusCase(t, "no-unnecessary-parameter-property-assignment.ts", `class Repeated {
  constructor(
    public value: string,
    private readonly count: number,
    normal: string,
  ) {
    // expect: no-unnecessary-parameter-property-assignment error
    this.value = value;
    // expect: no-unnecessary-parameter-property-assignment error
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
