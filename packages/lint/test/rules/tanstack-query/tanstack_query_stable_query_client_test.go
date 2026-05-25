package linthost

import "testing"

// TestRuleCorpusTanstackQueryStableQueryClient verifies the lint rule corpus fixture @tanstack/query/stable-query-client.ts.
//
// Creating QueryClient during component render produces a fresh client on every
// render. This pins the imported QueryClient constructor path inside a React
// component-shaped function.
//
// 1. Load a component-like function that constructs QueryClient locally.
// 2. Enable @tanstack/query/stable-query-client from its expect comment.
// 3. Assert the constructor expression is reported.
func TestRuleCorpusTanstackQueryStableQueryClient(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-stable-query-client.ts", `import { QueryClient } from "@tanstack/react-query";

export function TodosProvider() {
  // expect: @tanstack/query/stable-query-client error
  const client = new QueryClient();
  return client;
}
`)
}
