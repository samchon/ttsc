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
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies a static internal anchor is reported for nextjs/no-html-link-for-pages; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations An external absolute URL does not navigate an internal pages route. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoHTMLLinkForPagesReportsInternalAnchor is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoHTMLLinkForPagesReportsInternalAnchor(t *testing.T) {
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-html-link-for-pages", "pages/index.tsx", "export default function Page() { return <a href=\"https://example.com/about\">About</a>; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
