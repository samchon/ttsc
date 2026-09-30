package linthost

import "testing"

// TestNextjsNoHeadElementReportsRawHead verifies raw head tags are reported outside app.
//
// Raw `<head>` elements bypass Next.js head handling. The app directory is
// skipped separately, so a pages fixture exercises the diagnostic path.
//
// 1. Parse a pages TSX file.
// 2. Render a lowercase head element.
// 3. Assert `nextjs/no-head-element` reports it.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies raw head in a pages file is reported for nextjs/no-head-element; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The app directory permits its own document head under this rule. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename app/page.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoHeadElementReportsRawHead is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoHeadElementReportsRawHead(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  // expect: nextjs/no-head-element error
  return <head />;
}
`)
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-head-element", "app/page.tsx", "export default function Page() { return <head />; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
