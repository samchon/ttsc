package linthost

import "testing"

// TestNextjsNoHTMLLinkForPagesReportsInternalAnchor verifies internal anchors use next/link.
//
// The implementation avoids filesystem route discovery and flags static internal
// hrefs conservatively.
//
// 1. Parse a TSX page with an internal anchor.
// 2. Enable `nextjs/no-html-link-for-pages`.
// 3. Assert the anchor is reported.
func TestNextjsNoHTMLLinkForPagesReportsInternalAnchor(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  // expect: nextjs/no-html-link-for-pages error
  return <a href="/about">About</a>;
}
`)
}
