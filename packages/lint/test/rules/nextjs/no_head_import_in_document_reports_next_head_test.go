package linthost

import "testing"

// TestNextjsNoHeadImportInDocumentReportsNextHead verifies next/head is not used in pages/_document.
//
// The document file should use `Head` from `next/document`; this test pins the
// path-sensitive import branch.
//
// 1. Parse pages/_document importing `next/head`.
// 2. Enable `nextjs/no-head-import-in-document`.
// 3. Assert the import declaration is reported.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies next/head imported in _document is reported for nextjs/no-head-import-in-document; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The document entrypoint uses Head from next/document. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/_document.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoHeadImportInDocumentReportsNextHead is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoHeadImportInDocumentReportsNextHead(t *testing.T) {
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-head-import-in-document", "pages/_document.tsx", "import { Head } from \"next/document\"; export default function Document() { return <Head />; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
