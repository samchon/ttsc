package linthost

import "testing"

// TestRuleCorpusMethodSignatureStyle verifies the lint rule corpus fixture method-signature-style.ts.
//
// The first native slice implements the TypeScript-ESLint default mode:
// method signatures in interfaces and type literals are diagnostics, while
// existing function-property signatures and class methods are not.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification Interface and type-literal method signatures must report under property-style policy.
// @evidence contracts/testing.md#independent-expectations The independently authored fixture markers require exactly typescript/method-signature-style error findings at lines 3 and 9; complete rule/severity/line comparison rejects missing, extra or misidentified reports.
// @evidence contracts/testing.md#distinguishing-cases Existing function-property signatures and class method implementations remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusMethodSignatureStyle executes the AST Engine through assertRuleCorpusCase in the same Go unit process; no native build, installation or compiler child runs.
func TestRuleCorpusMethodSignatureStyle(t *testing.T) {
  assertRuleCorpusCase(t, "method-signature-style.ts", `interface Service {
  // expect: typescript/method-signature-style error
  run(input: string): number;
  keep: (input: string) => number;
}

type Handler = {
  // expect: typescript/method-signature-style error
  handle(): void;
  keep: () => void;
};

class Impl {
  run(input: string): number {
    return input.length;
  }
}

JSON.stringify({} as Service);
JSON.stringify({} as Handler);
JSON.stringify(Impl);
`)
}
