package linthost

import "testing"

// TestRuleCorpusTanstackQueryNoVoidQueryFn verifies the lint rule corpus fixture @tanstack/query/no-void-query-fn.ts.
//
// Query functions must return data for the cache. This native subset catches
// block-bodied queryFn callbacks that have no value-returning return statement.
//
// 1. Load a queryFn block that performs work but returns no value.
// 2. Enable @tanstack/query/no-void-query-fn from its expect comment.
// 3. Assert the queryFn initializer is reported.
func TestRuleCorpusTanstackQueryNoVoidQueryFn(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-no-void-query-fn.ts", `import { useQuery } from "@tanstack/react-query";

export function useTodos() {
  return useQuery({
    queryKey: ["todos"],
    // expect: @tanstack/query/no-void-query-fn error
    queryFn: () => {
      console.log("missing return");
    },
  });
}
`)
}
