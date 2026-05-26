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
func TestNextjsNoDocumentImportInPageReportsNextDocument(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
// expect: nextjs/no-document-import-in-page error
import Document from "next/document";

export default function Page() {
  return <main />;
}
`)
}
