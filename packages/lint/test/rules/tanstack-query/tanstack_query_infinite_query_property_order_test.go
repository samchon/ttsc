package linthost

import "testing"

// TestRuleCorpusTanstackQueryInfiniteQueryPropertyOrder verifies the lint rule corpus fixture @tanstack/query/infinite-query-property-order.ts.
//
// Infinite query callbacks are easier to audit when queryFn appears before
// page-param callbacks. This locks the imported useInfiniteQuery call path and
// the object-property ordering comparison.
//
// 1. Load an infinite query options object with getNextPageParam before queryFn.
// 2. Enable @tanstack/query/infinite-query-property-order from its expect comment.
// 3. Assert the earlier page-param callback is reported.
func TestRuleCorpusTanstackQueryInfiniteQueryPropertyOrder(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-infinite-query-property-order.ts", `import { useInfiniteQuery } from "@tanstack/react-query";

export function usePages() {
  return useInfiniteQuery({
    queryKey: ["pages"],
    // expect: @tanstack/query/infinite-query-property-order error
    getNextPageParam: (last) => last.next,
    queryFn: ({ pageParam }) => pageParam,
  });
}
`)
}
