package linthost

import "testing"

// TestNextjsNoAsyncClientComponentReportsDefaultAsync verifies async client components are rejected.
//
// React client components cannot be async. This test pins the `"use client"`
// directive scan plus `export default async function` detection.
//
// 1. Parse a TSX file with a client directive.
// 2. Export an async default component.
// 3. Assert `nextjs/no-async-client-component` reports it.
func TestNextjsNoAsyncClientComponentReportsDefaultAsync(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "app/page.tsx", `
"use client";

// expect: nextjs/no-async-client-component error
export default async function Page() {
  return null;
}
`)
}
