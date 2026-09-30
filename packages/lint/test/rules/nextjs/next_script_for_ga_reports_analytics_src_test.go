package linthost

import "testing"

// TestNextjsNextScriptForGAReportsAnalyticsSrc verifies static analytics.js sources are reported.
//
// Google Analytics' legacy loader is a separate static URL branch from the
// Google Tag Manager gtag loader. An unrelated native script is the negative
// twin so substring matching cannot classify every external script as GA.
//
//  1. Render native scripts for analytics.js and an unrelated dependency.
//  2. Enable `nextjs/next-script-for-ga` through the corpus helper.
//  3. Assert only the analytics.js opening reports.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies native analytics.js loader is reported while unrelated application.js stays clean for nextjs/next-script-for-ga; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The legacy Google Analytics host/path identifies the hand-written loader. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original fixture already carries its reported construct and the clean counterpart described above; exact finding enumeration keeps the counterpart from being over-reported. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNextScriptForGAReportsAnalyticsSrc is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNextScriptForGAReportsAnalyticsSrc(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  return (
    <>
      // expect: nextjs/next-script-for-ga error
      <script src="https://www.google-analytics.com/analytics.js" />
      <script src="https://cdn.example.com/application.js" />
    </>
  );
}
`)
}
