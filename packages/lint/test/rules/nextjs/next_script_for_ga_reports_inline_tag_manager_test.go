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
