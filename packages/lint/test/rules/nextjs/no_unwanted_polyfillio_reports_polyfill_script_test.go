package linthost

import "testing"

// TestNextjsNoUnwantedPolyfillIOReportsPolyfillScript verifies Polyfill.io script URLs are reported.
//
// This locks the literal src scan for raw script tags without relying on remote
// availability or browser feature data.
//
// 1. Parse a TSX page with a Polyfill.io script URL.
// 2. Enable `nextjs/no-unwanted-polyfillio`.
// 3. Assert the script tag is reported.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies a polyfill.io loader URL is reported for nextjs/no-unwanted-polyfillio; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The rule distinguishes the forbidden provider from unrelated script hosts. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoUnwantedPolyfillIOReportsPolyfillScript is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoUnwantedPolyfillIOReportsPolyfillScript(t *testing.T) {
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-unwanted-polyfillio", "pages/index.tsx", "export default function Page() { return <script src=\"https://cdn.example.com/application.js\" />; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
