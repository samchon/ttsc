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
func TestNextjsGoogleFontPreconnectRequiresRel(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  return (
    <>
      // expect: nextjs/google-font-preconnect error
      <link href="https://fonts.gstatic.com" />
    </>
  );
}
`)
}
