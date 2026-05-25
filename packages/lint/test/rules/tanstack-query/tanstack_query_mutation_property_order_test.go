package linthost

import "testing"

// TestRuleCorpusTanstackQueryMutationPropertyOrder verifies the lint rule corpus fixture @tanstack/query/mutation-property-order.ts.
//
// Mutation lifecycle callbacks depend on onMutate setting the optimistic
// context before error/settled handlers consume it. This pins the property
// order rule for imported useMutation calls.
//
// 1. Load a mutation options object with onError before onMutate.
// 2. Enable @tanstack/query/mutation-property-order from its expect comment.
// 3. Assert the out-of-order onError property is reported.
func TestRuleCorpusTanstackQueryMutationPropertyOrder(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-mutation-property-order.ts", `import { useMutation } from "@tanstack/react-query";

export function useSave() {
  return useMutation({
    mutationFn: async (input: string) => input,
    // expect: @tanstack/query/mutation-property-order error
    onError: () => {},
    onMutate: () => ({ snapshot: true }),
  });
}
`)
}
