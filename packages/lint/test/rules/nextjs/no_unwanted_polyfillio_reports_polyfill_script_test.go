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
func TestNextjsNoUnwantedPolyfillIOReportsPolyfillScript(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  return (
    <>
      // expect: nextjs/no-unwanted-polyfillio error
      <script src="https://polyfill.io/v3/polyfill.min.js?features=Array.prototype.includes" />
    </>
  );
}
`)
}
