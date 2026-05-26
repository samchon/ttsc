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
}
