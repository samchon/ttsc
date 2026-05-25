package linthost

import "testing"

// TestRuleCorpusTanstackQueryExhaustiveDeps verifies the lint rule corpus fixture @tanstack/query/exhaustive-deps.ts.
//
// TanStack Query keys must include changing values read by the query function.
// This pins the AST-local identifier path used before broader scope analysis is
// available in the native lint host.
//
// 1. Load a query options object with a queryFn that reads todoId.
// 2. Enable @tanstack/query/exhaustive-deps from the annotated expect comment.
// 3. Assert the missing queryKey dependency is reported on the queryFn line.
func TestRuleCorpusTanstackQueryExhaustiveDeps(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-exhaustive-deps.ts", `import { useQuery } from "@tanstack/react-query";
import { fetchTodo } from "./api";

export function useTodo(todoId: string) {
  return useQuery({
    queryKey: ["todo"],
    // expect: @tanstack/query/exhaustive-deps error
    queryFn: () => fetchTodo(todoId),
  });
}
`)
}
