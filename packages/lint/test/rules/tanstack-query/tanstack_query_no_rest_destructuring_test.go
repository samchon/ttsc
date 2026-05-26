package linthost

import "testing"

// TestRuleCorpusTanstackQueryNoRestDestructuring verifies the lint rule corpus fixture @tanstack/query/no-rest-destructuring.ts.
//
// Object rest over a tracked query result observes every result property and
// defeats TanStack Query's property tracking. This pins the direct hook-result
// destructuring path.
//
// 1. Load a useQuery result destructured with object rest.
// 2. Enable @tanstack/query/no-rest-destructuring from its expect comment.
// 3. Assert the object binding pattern is reported.
func TestRuleCorpusTanstackQueryNoRestDestructuring(t *testing.T) {
  assertRuleCorpusCase(t, "tanstack-query-no-rest-destructuring.ts", `import { useQuery } from "@tanstack/react-query";

export function Todos() {
  // expect: @tanstack/query/no-rest-destructuring error
  const { data, ...rest } = useQuery({
    queryKey: ["todos"],
    queryFn: () => ["todo"],
  });
  return data ?? rest.status;
}
`)
}
