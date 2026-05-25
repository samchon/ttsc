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
func TestRuleCorpusMethodSignatureStyle(t *testing.T) {
  assertRuleCorpusCase(t, "method-signature-style.ts", `interface Service {
  // expect: method-signature-style error
  run(input: string): number;
  keep: (input: string) => number;
}

type Handler = {
  // expect: method-signature-style error
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
