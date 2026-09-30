package linthost

import "testing"

// TestNextjsNoTitleInDocumentHeadReportsTitle verifies document Head does not contain title.
//
// pages/_document cannot own per-page titles. This pins the named import and
// nested JSX title scan.
//
// 1. Import Head from `next/document`.
// 2. Render a title inside that Head.
// 3. Assert the title element is reported.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies title inside document Head is reported for nextjs/no-title-in-document-head; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations Document Head may contain other metadata, but per-page titles belong elsewhere. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/_document.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoTitleInDocumentHeadReportsTitle is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoTitleInDocumentHeadReportsTitle(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/_document.tsx", `
import { Head } from "next/document";

export default function Document() {
  return (
    <Head>
      // expect: nextjs/no-title-in-document-head error
      <title>Bad</title>
    </Head>
  );
}
`)
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-title-in-document-head", "pages/_document.tsx", "import { Head } from \"next/document\"; export default function Document() { return <Head><meta charSet=\"utf-8\" /></Head>; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
