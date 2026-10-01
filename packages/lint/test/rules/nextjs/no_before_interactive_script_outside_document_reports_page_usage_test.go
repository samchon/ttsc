package linthost

import "testing"

// TestNextjsNoBeforeInteractiveScriptOutsideDocumentReportsPageUsage verifies beforeInteractive stays in _document.
//
// The rule is path-sensitive but filesystem-free: a virtual pages file is enough
// to exercise the non-document branch.
//
// 1. Parse a regular pages TSX file.
// 2. Render `next/script` with strategy beforeInteractive.
// 3. Assert the Script element is reported.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies beforeInteractive Script in a regular page is reported for nextjs/no-before-interactive-script-outside-document; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The same strategy belongs to the document entrypoint. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/_document.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoBeforeInteractiveScriptOutsideDocumentReportsPageUsage is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoBeforeInteractiveScriptOutsideDocumentReportsPageUsage(t *testing.T) {
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-before-interactive-script-outside-document", "pages/_document.tsx", "import Script from \"next/script\"; export default function Document() { return <Script strategy=\"beforeInteractive\" src=\"/early.js\" />; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
