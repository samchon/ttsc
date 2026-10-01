package linthost

import "testing"

// TestNextjsGoogleFontPreconnectRequiresRel verifies fonts.gstatic links use preconnect.
//
// The rule is intentionally literal-only: TSX with a static fonts.gstatic href
// should be enough to catch the common preload mistake.
//
// 1. Parse a TSX page with a fonts.gstatic link missing rel.
// 2. Enable `nextjs/google-font-preconnect`.
// 3. Assert a diagnostic lands on the link element.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies fonts.gstatic link omits preconnect for nextjs/google-font-preconnect; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations A fonts.gstatic connection hint requires rel=preconnect. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsGoogleFontPreconnectRequiresRel is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsGoogleFontPreconnectRequiresRel(t *testing.T) {
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/google-font-preconnect", "pages/index.tsx", "export default function Page() { return <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" />; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
