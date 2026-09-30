package linthost

import "testing"

// TestRuleCorpusTanstackQueryNoVoidQueryFn verifies the lint rule corpus fixture tanstack-query/no-void-query-fn.ts.
//
// Query functions must return data for the cache. This native subset catches
// block-bodied queryFn callbacks that have no value-returning return statement.
//
// 1. Load a queryFn block that performs work but returns no value.
// 2. Enable tanstack-query/no-void-query-fn from its expect comment.
// 3. Assert the queryFn initializer is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase runs the actual engine and verifies the annotated tanstack-query/no-void-query-fn finding where a block queryFn never returns data; exact rule/severity/line comparison rejects omissions and extra diagnostics.
// @evidence contracts/testing.md#independent-expectations The literal marked source states the supported tanstack-query/no-void-query-fn policy, and the separately authored accepted source changes its relevant condition; no expected diagnostic is generated from the rule result.
// @evidence contracts/testing.md#distinguishing-cases A block returning data satisfies the cache-value contract. The original marked violation and this zero-finding control both execute; the AST-local corpus does not claim runtime React or cache behavior.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTanstackQueryNoVoidQueryFn is a named Go unit entry using virtual TypeScript source and the owning engine in the shared test process; imports are parsed syntax, not installed TanStack consumers.
func TestRuleCorpusTanstackQueryNoVoidQueryFn(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-no-void-query-fn.ts", `import { useQuery } from "@tanstack/react-query";

export function useTodos() {
  return useQuery({
    queryKey: ["todos"],
    // expect: tanstack-query/no-void-query-fn error
    queryFn: () => {
      console.log("missing return");
    },
  });
}
`)
  assertRuleSkipsSource(t, "tanstack-query/no-void-query-fn", "import { useQuery } from \"@tanstack/react-query\"; export function useTodos() { return useQuery({ queryKey: [\"todos\"], queryFn: () => { return [\"todo\"]; } }); }\n")
}
