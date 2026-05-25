package linthost

import "testing"

// TestRuleCorpusTanstackQueryNoUnstableDeps verifies the lint rule corpus fixture @tanstack/query/no-unstable-deps.ts.
//
// TanStack Query hook results are wrapper objects and are not stable dependency
// values. This pins the cross-node scan from a hook-result variable into a
// React dependency array.
//
// 1. Load a useQuery result stored in a local identifier.
// 2. Pass that identifier directly to React.useEffect dependencies.
// 3. Assert @tanstack/query/no-unstable-deps reports the dependency element.
func TestRuleCorpusTanstackQueryNoUnstableDeps(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-no-unstable-deps.ts", `import * as React from "react";
import { useQuery } from "@tanstack/react-query";

export function Todos() {
  const result = useQuery({
    queryKey: ["todos"],
    queryFn: () => ["todo"],
  });
  // expect: @tanstack/query/no-unstable-deps error
  React.useEffect(() => {}, [result]);
  return result.data;
}
`)
}
