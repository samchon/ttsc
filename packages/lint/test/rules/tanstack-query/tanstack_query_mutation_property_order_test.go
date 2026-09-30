package linthost

import "testing"

// TestRuleCorpusTanstackQueryMutationPropertyOrder verifies the lint rule corpus fixture tanstack-query/mutation-property-order.ts.
//
// Mutation lifecycle callbacks depend on onMutate setting the optimistic
// context before error/settled handlers consume it. This pins the property
// order rule for imported useMutation calls.
//
// 1. Load a mutation options object with onError before onMutate.
// 2. Enable tanstack-query/mutation-property-order from its expect comment.
// 3. Assert the out-of-order onError property is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase runs the actual engine and verifies the annotated tanstack-query/mutation-property-order finding where onError precedes onMutate; exact rule/severity/line comparison rejects omissions and extra diagnostics.
// @evidence contracts/testing.md#independent-expectations The literal marked source states the supported tanstack-query/mutation-property-order policy, and the separately authored accepted source changes its relevant condition; no expected diagnostic is generated from the rule result.
// @evidence contracts/testing.md#distinguishing-cases onMutate before onError establishes lifecycle option ordering. The original marked violation and this zero-finding control both execute; the AST-local corpus does not claim runtime React or cache behavior.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTanstackQueryMutationPropertyOrder is a named Go unit entry using virtual TypeScript source and the owning engine in the shared test process; imports are parsed syntax, not installed TanStack consumers.
func TestRuleCorpusTanstackQueryMutationPropertyOrder(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-mutation-property-order.ts", `import { useMutation } from "@tanstack/react-query";

export function useSave() {
  return useMutation({
    mutationFn: async (input: string) => input,
    // expect: tanstack-query/mutation-property-order error
    onError: () => {},
    onMutate: () => ({ snapshot: true }),
  });
}
`)
  assertRuleSkipsSource(t, "tanstack-query/mutation-property-order", "import { useMutation } from \"@tanstack/react-query\"; export function useSave() { return useMutation({ mutationFn: async input => input, onMutate: () => ({ snapshot: true }), onError: () => {} }); }\n")
}
