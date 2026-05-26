package linthost

import "testing"

// TestNextjsNextScriptForGAReportsGtagSrc verifies handwritten GA scripts are reported.
//
// The implementation only needs static `next/script` src values; this keeps the
// rule independent from Next.js runtime packages.
//
// 1. Import Script from `next/script`.
// 2. Render a Google Tag Manager gtag URL.
// 3. Assert `nextjs/next-script-for-ga` reports the Script element.
func TestNextjsNextScriptForGAReportsGtagSrc(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
import Script from "next/script";

export default function Page() {
  return (
    <>
      // expect: nextjs/next-script-for-ga error
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-1" />
    </>
  );
}
`)
}
