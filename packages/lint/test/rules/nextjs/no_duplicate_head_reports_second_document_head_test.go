package linthost

import "testing"

// TestNextjsNoDuplicateHeadReportsSecondDocumentHead verifies duplicate next/document Head elements are rejected.
//
// pages/_document should render one document Head. This locks the named import
// alias tracking and duplicate JSX opening scan.
//
// 1. Parse pages/_document importing `Head` from `next/document`.
// 2. Render two `Head` elements.
// 3. Assert the second element is reported.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies the second document Head is reported while the first is retained for nextjs/no-duplicate-head; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The document must render a singleton Head. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/_document.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoDuplicateHeadReportsSecondDocumentHead is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoDuplicateHeadReportsSecondDocumentHead(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/_document.tsx", `
import { Head } from "next/document";

export default function Document() {
  return (
    <>
      <Head />
      // expect: nextjs/no-duplicate-head error
      <Head />
    </>
  );
}
`)
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-duplicate-head", "pages/_document.tsx", "import { Head } from \"next/document\"; export default function Document() { return <Head />; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
