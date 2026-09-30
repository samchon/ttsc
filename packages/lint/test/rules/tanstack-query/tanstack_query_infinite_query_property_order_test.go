package linthost

import "testing"

// TestRuleCorpusTanstackQueryInfiniteQueryPropertyOrder verifies the lint rule corpus fixture tanstack-query/infinite-query-property-order.ts.
//
// Infinite query callbacks are easier to audit when queryFn appears before
// page-param callbacks. This locks the imported useInfiniteQuery call path and
// the object-property ordering comparison.
//
// 1. Load an infinite query options object with getNextPageParam before queryFn.
// 2. Enable tanstack-query/infinite-query-property-order from its expect comment.
// 3. Assert the earlier page-param callback is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase runs the actual engine and verifies the annotated tanstack-query/infinite-query-property-order finding where getNextPageParam precedes queryFn; exact rule/severity/line comparison rejects omissions and extra diagnostics.
// @evidence contracts/testing.md#independent-expectations The literal marked source states the supported tanstack-query/infinite-query-property-order policy, and the separately authored accepted source changes its relevant condition; no expected diagnostic is generated from the rule result.
// @evidence contracts/testing.md#distinguishing-cases queryFn before getNextPageParam satisfies the supported ordering. The original marked violation and this zero-finding control both execute; the AST-local corpus does not claim runtime React or cache behavior.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTanstackQueryInfiniteQueryPropertyOrder is a named Go unit entry using virtual TypeScript source and the owning engine in the shared test process; imports are parsed syntax, not installed TanStack consumers.
func TestRuleCorpusTanstackQueryInfiniteQueryPropertyOrder(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-infinite-query-property-order.ts", `import { useInfiniteQuery } from "@tanstack/react-query";

export function usePages() {
  return useInfiniteQuery({
    queryKey: ["pages"],
    // expect: tanstack-query/infinite-query-property-order error
    getNextPageParam: (last) => last.next,
    queryFn: ({ pageParam }) => pageParam,
  });
}
`)
  assertRuleSkipsSource(t, "tanstack-query/infinite-query-property-order", "import { useInfiniteQuery } from \"@tanstack/react-query\"; export function usePages() { return useInfiniteQuery({ queryKey: [\"pages\"], queryFn: ({ pageParam }) => pageParam, getNextPageParam: last => last.next }); }\n")
}
