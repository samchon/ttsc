package linthost

import "testing"

// TestRuleCorpusTanstackQueryPreferQueryOptions verifies the lint rule corpus fixture tanstack-query/prefer-query-options.ts.
//
// Shared query options preserve inference and reuse across hooks and query
// clients. This pins the high-confidence imported hook call form with inline
// queryKey/queryFn options.
//
// 1. Load a useQuery call with an inline options object.
// 2. Enable tanstack-query/prefer-query-options from its expect comment.
// 3. Assert the inline options object is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase runs the actual engine and verifies the annotated tanstack-query/prefer-query-options finding where useQuery receives inline queryKey/queryFn options; exact rule/severity/line comparison rejects omissions and extra diagnostics.
// @evidence contracts/testing.md#independent-expectations The literal marked source states the supported tanstack-query/prefer-query-options policy, and the separately authored accepted source changes its relevant condition; no expected diagnostic is generated from the rule result.
// @evidence contracts/testing.md#distinguishing-cases Passing an options identifier avoids the inline-object violation. The original marked violation and this zero-finding control both execute; the AST-local corpus does not claim runtime React or cache behavior.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTanstackQueryPreferQueryOptions is a named Go unit entry using virtual TypeScript source and the owning engine in the shared test process; imports are parsed syntax, not installed TanStack consumers.
func TestRuleCorpusTanstackQueryPreferQueryOptions(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-prefer-query-options.ts", `import { useQuery } from "@tanstack/react-query";
import { fetchTodo } from "./api";

export function useTodo(todoId: string) {
  // expect: tanstack-query/prefer-query-options error
  return useQuery({ queryKey: ["todo", todoId], queryFn: () => fetchTodo(todoId) });
}
`)
  assertRuleSkipsSource(t, "tanstack-query/prefer-query-options", "import { useQuery } from \"@tanstack/react-query\"; const options = { queryKey: [\"todos\"], queryFn: () => [\"todo\"] }; export function Todos() { return useQuery(options); }\n")
}
