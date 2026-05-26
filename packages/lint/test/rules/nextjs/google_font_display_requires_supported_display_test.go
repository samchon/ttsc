package linthost

import "testing"

// TestNextjsGoogleFontDisplayRequiresSupportedDisplay verifies Google font links require a supported display query.
//
// This pins the AST-only Google Fonts URL branch without depending on a Next.js
// project graph or network fetch.
//
// 1. Parse a TSX page containing a Google Fonts stylesheet without display.
// 2. Enable `nextjs/google-font-display`.
// 3. Assert the lint engine reports the link element.
func TestNextjsGoogleFontDisplayRequiresSupportedDisplay(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  return (
    <>
      // expect: nextjs/google-font-display error
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />
    </>
  );
}
`)
}
