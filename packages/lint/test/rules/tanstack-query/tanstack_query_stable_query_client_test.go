package linthost

import "testing"

// TestRuleCorpusTanstackQueryStableQueryClient verifies the lint rule corpus fixture tanstack-query/stable-query-client.ts.
//
// Creating QueryClient during component render produces a fresh client on every
// render. This pins the imported QueryClient constructor path inside a React
// component-shaped function.
//
// 1. Load a component-like function that constructs QueryClient locally.
// 2. Enable tanstack-query/stable-query-client from its expect comment.
// 3. Assert the constructor expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase runs the actual engine and verifies the annotated tanstack-query/stable-query-client finding where a component-like function creates QueryClient during render; exact rule/severity/line comparison rejects omissions and extra diagnostics.
// @evidence contracts/testing.md#independent-expectations The literal marked source states the supported tanstack-query/stable-query-client policy, and the separately authored accepted source changes its relevant condition; no expected diagnostic is generated from the rule result.
// @evidence contracts/testing.md#distinguishing-cases A module-scope QueryClient allocation is reused across component calls. The original marked violation and this zero-finding control both execute; the AST-local corpus does not claim runtime React or cache behavior.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTanstackQueryStableQueryClient is a named Go unit entry using virtual TypeScript source and the owning engine in the shared test process; imports are parsed syntax, not installed TanStack consumers.
func TestRuleCorpusTanstackQueryStableQueryClient(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-stable-query-client.ts", `import { QueryClient } from "@tanstack/react-query";

export function TodosProvider() {
  // expect: tanstack-query/stable-query-client error
  const client = new QueryClient();
  return client;
}
`)
  assertRuleSkipsSource(t, "tanstack-query/stable-query-client", "import { QueryClient } from \"@tanstack/react-query\"; const client = new QueryClient(); export function TodosProvider() { return client; }\n")
}
