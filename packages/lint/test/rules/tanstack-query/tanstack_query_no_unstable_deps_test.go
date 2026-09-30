package linthost

import "testing"

// TestRuleCorpusTanstackQueryNoUnstableDeps verifies the lint rule corpus fixture tanstack-query/no-unstable-deps.ts.
//
// TanStack Query hook results are wrapper objects and are not stable dependency
// values. This pins the cross-node scan from a hook-result variable into a
// React dependency array.
//
// 1. Load a useQuery result stored in a local identifier.
// 2. Pass that identifier directly to React.useEffect dependencies.
// 3. Assert tanstack-query/no-unstable-deps reports the dependency element.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase runs the actual engine and verifies the annotated tanstack-query/no-unstable-deps finding where the full query-result wrapper enters useEffect dependencies; exact rule/severity/line comparison rejects omissions and extra diagnostics.
// @evidence contracts/testing.md#independent-expectations The literal marked source states the supported tanstack-query/no-unstable-deps policy, and the separately authored accepted source changes its relevant condition; no expected diagnostic is generated from the rule result.
// @evidence contracts/testing.md#distinguishing-cases The data member can be a dependency without depending on the unstable wrapper. The original marked violation and this zero-finding control both execute; the AST-local corpus does not claim runtime React or cache behavior.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTanstackQueryNoUnstableDeps is a named Go unit entry using virtual TypeScript source and the owning engine in the shared test process; imports are parsed syntax, not installed TanStack consumers.
func TestRuleCorpusTanstackQueryNoUnstableDeps(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-no-unstable-deps.ts", `import * as React from "react";
import { useQuery } from "@tanstack/react-query";

export function Todos() {
  const result = useQuery({
    queryKey: ["todos"],
    queryFn: () => ["todo"],
  });
  // expect: tanstack-query/no-unstable-deps error
  React.useEffect(() => {}, [result]);
  return result.data;
}
`)
  assertRuleSkipsSource(t, "tanstack-query/no-unstable-deps", "import * as React from \"react\"; import { useQuery } from \"@tanstack/react-query\"; export function Todos() { const result = useQuery({ queryKey: [\"todos\"], queryFn: () => [\"todo\"] }); React.useEffect(() => {}, [result.data]); return result.data; }\n")
}
