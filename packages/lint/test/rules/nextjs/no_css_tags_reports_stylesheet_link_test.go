package linthost

import "testing"

// TestNextjsNoCSSTagsReportsStylesheetLink verifies raw stylesheet links are reported.
//
// Next.js expects CSS imports through supported entrypoints. This keeps the rule
// at the JSX attribute level.
//
// 1. Parse a TSX page with a stylesheet link.
// 2. Enable `nextjs/no-css-tags`.
// 3. Assert the raw link tag is reported.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies raw stylesheet link is reported for nextjs/no-css-tags; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations CSS import is the supported stylesheet ownership path. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoCSSTagsReportsStylesheetLink is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoCSSTagsReportsStylesheetLink(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  return (
    <>
      // expect: nextjs/no-css-tags error
      <link rel="stylesheet" href="/main.css" />
    </>
  );
}
`)
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-css-tags", "pages/index.tsx", "import \"./main.css\"; export default function Page() { return <main />; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
