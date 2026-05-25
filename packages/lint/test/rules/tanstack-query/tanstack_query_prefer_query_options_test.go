package linthost

import "testing"

// TestRuleCorpusTanstackQueryPreferQueryOptions verifies the lint rule corpus fixture @tanstack/query/prefer-query-options.ts.
//
// Shared query options preserve inference and reuse across hooks and query
// clients. This pins the high-confidence imported hook call form with inline
// queryKey/queryFn options.
//
// 1. Load a useQuery call with an inline options object.
// 2. Enable @tanstack/query/prefer-query-options from its expect comment.
// 3. Assert the inline options object is reported.
func TestRuleCorpusTanstackQueryPreferQueryOptions(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-prefer-query-options.ts", `import { useQuery } from "@tanstack/react-query";
import { fetchTodo } from "./api";

export function useTodo(todoId: string) {
  // expect: @tanstack/query/prefer-query-options error
  return useQuery({ queryKey: ["todo", todoId], queryFn: () => fetchTodo(todoId) });
}
`)
}
