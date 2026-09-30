package linthost

import "testing"

// TestNextjsNextScriptForGAReportsGtagSrc verifies handwritten GA scripts are reported.
//
// The upstream rule owns native `script` tags. A component imported from
// `next/script` may carry the same URL but is not the hand-written HTML shape,
// so it is the adjacent negative that prevents an over-match by tag text.
//
//  1. Render a native script with a static Google Tag Manager gtag URL.
//  2. Render the same URL through the imported `next/script` component.
//  3. Assert only the native script reports.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies native gtag/js loader is reported while next/script stays clean for the same URL for nextjs/next-script-for-ga; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The native script and Next Script component differ in supported loader ownership. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original fixture already carries its reported construct and the clean counterpart described above; exact finding enumeration keeps the counterpart from being over-reported. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNextScriptForGAReportsGtagSrc is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNextScriptForGAReportsGtagSrc(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
import Script from "next/script";

export default function Page() {
  return (
    <>
      // expect: nextjs/next-script-for-ga error
      <script src="https://www.googletagmanager.com/gtag/js?id=G-1" />
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-1" />
    </>
  );
}
`)
}
