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
