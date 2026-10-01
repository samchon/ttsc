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
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies named async default client component is reported for nextjs/no-async-client-component; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations A synchronous client component satisfies client rendering requirements. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename app/page.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoAsyncClientComponentReportsDefaultAsync is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoAsyncClientComponentReportsDefaultAsync(t *testing.T) {
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-async-client-component", "app/page.tsx", "\"use client\"; export default function Page() { return null; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
