package linthost

import "testing"

// TestRuleCorpusTanstackQueryExhaustiveDeps verifies the lint rule corpus fixture tanstack-query/exhaustive-deps.ts.
//
// TanStack Query keys must include changing values read by the query function.
// This pins the AST-local identifier path used before broader scope analysis is
// available in the native lint host.
//
// 1. Load a query options object with a queryFn that reads todoId.
// 2. Enable tanstack-query/exhaustive-deps from the annotated expect comment.
// 3. Assert the missing queryKey dependency is reported on the queryFn line.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase runs the actual engine and verifies the annotated tanstack-query/exhaustive-deps finding where queryFn reads todoId absent from queryKey; exact rule/severity/line comparison rejects omissions and extra diagnostics.
// @evidence contracts/testing.md#independent-expectations The literal marked source states the supported tanstack-query/exhaustive-deps policy, and the separately authored accepted source changes its relevant condition; no expected diagnostic is generated from the rule result.
// @evidence contracts/testing.md#distinguishing-cases A key containing todoId covers the captured changing dependency; unrelated imported fetchTodo is not a changing key input. The original marked violation and this zero-finding control both execute; the AST-local corpus does not claim runtime React or cache behavior.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTanstackQueryExhaustiveDeps is a named Go unit entry using virtual TypeScript source and the owning engine in the shared test process; imports are parsed syntax, not installed TanStack consumers.
func TestRuleCorpusTanstackQueryExhaustiveDeps(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-exhaustive-deps.ts", `import { useQuery } from "@tanstack/react-query";
import { fetchTodo } from "./api";

export function useTodo(todoId: string) {
  return useQuery({
    queryKey: ["todo"],
    // expect: tanstack-query/exhaustive-deps error
    queryFn: () => fetchTodo(todoId),
  });
}
`)
  assertRuleSkipsSource(t, "tanstack-query/exhaustive-deps", "import { useQuery } from \"@tanstack/react-query\"; import { fetchTodo } from \"./api\"; export function useTodo(todoId: string) { return useQuery({ queryKey: [\"todo\", todoId], queryFn: () => fetchTodo(todoId) }); }\n")
}
