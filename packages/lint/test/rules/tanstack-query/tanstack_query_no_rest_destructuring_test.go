package linthost

import "testing"

// TestRuleCorpusTanstackQueryNoRestDestructuring verifies the lint rule corpus fixture tanstack-query/no-rest-destructuring.ts.
//
// Object rest over a tracked query result observes every result property and
// defeats TanStack Query's property tracking. This pins the direct hook-result
// destructuring path.
//
// 1. Load a useQuery result destructured with object rest.
// 2. Enable tanstack-query/no-rest-destructuring from its expect comment.
// 3. Assert the object binding pattern is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase runs the actual engine and verifies the annotated tanstack-query/no-rest-destructuring finding where object rest destructures a tracked useQuery result; exact rule/severity/line comparison rejects omissions and extra diagnostics.
// @evidence contracts/testing.md#independent-expectations The literal marked source states the supported tanstack-query/no-rest-destructuring policy, and the separately authored accepted source changes its relevant condition; no expected diagnostic is generated from the rule result.
// @evidence contracts/testing.md#distinguishing-cases Selecting data without a rest binding preserves tracked-property access. The original marked violation and this zero-finding control both execute; the AST-local corpus does not claim runtime React or cache behavior.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTanstackQueryNoRestDestructuring is a named Go unit entry using virtual TypeScript source and the owning engine in the shared test process; imports are parsed syntax, not installed TanStack consumers.
func TestRuleCorpusTanstackQueryNoRestDestructuring(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-no-rest-destructuring.ts", `import { useQuery } from "@tanstack/react-query";

export function Todos() {
  // expect: tanstack-query/no-rest-destructuring error
  const { data, ...rest } = useQuery({
    queryKey: ["todos"],
    queryFn: () => ["todo"],
  });
  return data ?? rest.status;
}
`)
  assertRuleSkipsSource(t, "tanstack-query/no-rest-destructuring", "import { useQuery } from \"@tanstack/react-query\"; export function Todos() { const { data } = useQuery({ queryKey: [\"todos\"], queryFn: () => [\"todo\"] }); return data; }\n")
}
