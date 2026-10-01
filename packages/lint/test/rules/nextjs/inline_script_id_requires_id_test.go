package linthost

import "testing"

// TestNextjsInlineScriptIDRequiresID verifies inline next/script content needs an id.
//
// Inline scripts are keyed by id for stable injection. This locks the default
// import tracking and JSX children path together.
//
// 1. Import the default Script component from `next/script`.
// 2. Render inline script text without an id.
// 3. Assert `nextjs/inline-script-id` reports the Script element.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies inline next/script content omits id for nextjs/inline-script-id; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations An explicit id identifies the inline script for stable injection. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsInlineScriptIDRequiresID is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsInlineScriptIDRequiresID(t *testing.T) {
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/inline-script-id", "pages/index.tsx", "import Script from \"next/script\"; export default function Page() { return <Script id=\"ready\">{\"window.__ready = true;\"}</Script>; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
