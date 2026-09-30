package linthost

import "testing"

// TestNextjsNoDocumentImportInPageReportsNextDocument verifies next/document imports stay in _document.
//
// This rule is intentionally path-based and does not inspect a real Next.js
// pages directory.
//
// 1. Parse a regular pages file importing `next/document`.
// 2. Enable `nextjs/no-document-import-in-page`.
// 3. Assert the import declaration is reported.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies next/document imported in a regular page is reported for nextjs/no-document-import-in-page; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations next/document belongs to pages/_document. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/_document.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoDocumentImportInPageReportsNextDocument is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoDocumentImportInPageReportsNextDocument(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
// expect: nextjs/no-document-import-in-page error
import Document from "next/document";

export default function Page() {
  return <main />;
}
`)
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-document-import-in-page", "pages/_document.tsx", "import Document from \"next/document\"; export default Document;\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
