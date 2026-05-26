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
}
