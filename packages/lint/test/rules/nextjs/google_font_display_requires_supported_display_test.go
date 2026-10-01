package linthost

import "testing"

// TestNextjsGoogleFontDisplayRequiresSupportedDisplay verifies Google font links require a supported display query.
//
// This pins the AST-only Google Fonts URL branch without depending on a Next.js
// project graph or network fetch.
//
// 1. Parse a TSX page containing a Google Fonts stylesheet without display.
// 2. Enable `nextjs/google-font-display`.
// 3. Assert the lint engine reports the link element.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies a Google Fonts URL omits display for nextjs/google-font-display; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The supported font-display query controls font rendering; display=swap supplies it. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsGoogleFontDisplayRequiresSupportedDisplay is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsGoogleFontDisplayRequiresSupportedDisplay(t *testing.T) {
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/google-font-display", "pages/index.tsx", "export default function Page() { return <link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Inter&display=swap\" />; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
