package linthost

import "testing"

// TestNextjsNoAsyncClientComponentReportsAnonymousDefaultAsync verifies anonymous default async client components are rejected.
//
// React client components cannot be async. This test pins the unnamed default
// function declaration branch because it has no component name to pass through
// the capitalized-name filter used by named component declarations.
//
// 1. Parse a TSX file with a client directive.
// 2. Export an anonymous async default component.
// 3. Assert `nextjs/no-async-client-component` reports it.
func TestNextjsNoAsyncClientComponentReportsAnonymousDefaultAsync(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "app/page.tsx", `
"use client";

// expect: nextjs/no-async-client-component error
export default async function () {
  return null;
}
`)
}
