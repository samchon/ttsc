package linthost

import "testing"

// TestNextjsNextScriptForGAReportsInlineTagManager verifies static inline GTM payloads are reported.
//
// Google Tag Manager's inline loader uses gtm.js rather than the gtag/js URL
// used by the static `src` branch. A static non-GTM template literal is the
// negative twin for exact host/path matching.
//
//  1. Render native scripts with static template-literal `__html` payloads.
//  2. Use gtm.js in one payload and an unrelated loader in the other.
//  3. Assert only the GTM payload reports.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies static gtm.js payload is reported while an unrelated template literal stays clean for nextjs/next-script-for-ga; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The Google Tag Manager host and path identify its inline loader. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original fixture already carries its reported construct and the clean counterpart described above; exact finding enumeration keeps the counterpart from being over-reported. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNextScriptForGAReportsInlineTagManager is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNextScriptForGAReportsInlineTagManager(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  return (
    <>
      // expect: nextjs/next-script-for-ga error
      <script dangerouslySetInnerHTML={{ __html: `+"`https://www.googletagmanager.com/gtm.js?id=GTM-1`"+` }} />
      <script dangerouslySetInnerHTML={{ __html: `+"`https://cdn.example.com/loader.js`"+` }} />
    </>
  );
}
`)
}
