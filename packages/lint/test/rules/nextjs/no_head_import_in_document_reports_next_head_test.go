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
func TestNextjsNoHeadImportInDocumentReportsNextHead(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/_document.tsx", `
// expect: nextjs/no-head-import-in-document error
import Head from "next/head";

export default function Document() {
  return <Head />;
}
`)
}
